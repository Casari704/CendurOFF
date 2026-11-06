package cz.cenduroff.app.car

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarIcon
import androidx.car.app.model.Template
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import cz.cenduroff.app.R
import cz.cenduroff.app.roadbook.AtlasRepo
import cz.cenduroff.app.roadbook.AtlasRoute
import cz.cenduroff.app.roadbook.Roadbook
import cz.cenduroff.app.roadbook.RoadbookRepo
import java.util.concurrent.Executors
import kotlin.math.min

/**
 * Navigace ROADBOOK – výběr trasy z mapy. Na mapě (sever nahoře, já uprostřed) jsou všechny trasy:
 * bez roadbooku šedě, s roadbookem výrazně žluto-oranžově. Klepnutí na trasu s roadbookem ji vybere
 * (modře), nahoře se ukáže název a tlačítko „Jet“. Klepnutí do prázdné mapy výběr zruší.
 * Když se přiblížím k trase s roadbookem, aplikace se sama zeptá, jestli podle něj navigovat.
 * „Seznam“ = původní výběr ze seznamu (záloha).
 */
class RoadbookPickScreen(carContext: CarContext) : Screen(carContext), SurfaceHub.Target, LocationListener {

    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val tiles = TileCache(carContext) { redraw() }
    private val renderer = AtlasRenderer(tiles)

    private var routes: List<AtlasRoute> = emptyList()
    private var loading: String? = null
    private var message: String? = null
    private var opening = false

    private var lat = 49.87
    private var lon = 17.87
    private var hasFix = false
    private var zoom = 12
    private var scaleAcc = 1f
    private var selectedId: Int? = null
    private var autoReversed = false     // automatický roadbook: jet trasu obráceně

    // stejné barvy stavů jako na webu
    private val stateColors = mapOf(
        "ready" to Color.parseColor("#F5A300"),
        "check" to Color.parseColor("#D32F2F"),
        "draft" to Color.parseColor("#7E57C2"),
        "auto" to Color.parseColor("#8A8A8A")
    )
    private fun stateLabel(st: String) = when (st) {
        "ready" -> "Ready"; "check" -> "To check"; "draft" -> "Rozpracovaný"; else -> "Auto"
    }

    // automatická nabídka u trasy: na které trase už jsem nabídku dostal (znovu až po vzdálení)
    private val asked = HashSet<Int>()
    private var promptOpen = false

    private val buttons = ButtonBar()
    private fun btnList(): List<ButtonBar.Btn> {
        val list = ArrayList<ButtonBar.Btn>()
        val sel = selectedRoute()
        if (sel != null) list.add(ButtonBar.Btn("Jet ▶") { go() })
        if (sel != null && !sel.hasRoadbook) list.add(ButtonBar.Btn("⇅ Směr") { autoReversed = !autoReversed; redraw() })
        list.add(ButtonBar.Btn("Seznam") { screenManager.push(RoadbookListScreen(carContext)) })
        list.add(ButtonBar.Btn("−3") { setZoom(zoom - 3) })
        list.add(ButtonBar.Btn("−") { setZoom(zoom - 1) })
        list.add(ButtonBar.Btn("+") { setZoom(zoom + 1) })
        list.add(ButtonBar.Btn("+3") { setZoom(zoom + 3) })
        list.add(ButtonBar.Btn("Zpět") { screenManager.popToRoot() })
        return list
    }

    private val locationManager = carContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onCreate(owner: LifecycleOwner) {
                startGps()
                loadRoutes()
            }

            override fun onStart(owner: LifecycleOwner) {
                opening = false
                SurfaceHub.attach(carContext, this@RoadbookPickScreen)
            }

            override fun onDestroy(owner: LifecycleOwner) {
                try { locationManager.removeUpdates(this@RoadbookPickScreen) } catch (e: Exception) {}
                tiles.shutdown()
                SurfaceHub.detach(this@RoadbookPickScreen)
            }
        })
    }

    override fun onGetTemplate(): Template {
        val home = Action.Builder()
            .setIcon(CarIcon.Builder(IconCompat.createWithResource(carContext, R.drawable.ic_car_home)).build())
            .setOnClickListener { screenManager.popToRoot() }
            .build()
        return NavigationTemplate.Builder()
            .setActionStrip(ActionStrip.Builder().addAction(home).build())
            .build()
    }

    // ---------------- data ----------------
    private fun loadRoutes() {
        loading = "Načítám trasy uložené v telefonu"
        worker.execute {
            val repo = AtlasRepo(carContext)
            val cached = repo.loadCached()?.let { sortRoutes(it) }
            main.post {
                if (!cached.isNullOrEmpty()) { routes = cached; loading = null }
                else loading = "Stahuji trasy ze serveru (poprvé to chvíli trvá)"
                redraw()
            }
            val fresh = repo.loadOnline()?.let { sortRoutes(it) }
            main.post {
                if (fresh != null) routes = fresh
                loading = null
                message = when {
                    routes.isEmpty() && fresh == null -> "Offline – trasy nejsou uložené (zkus Seznam)"
                    routes.none { it.hasRoadbook } -> "Žádná trasa zatím nemá roadbook"
                    else -> null
                }
                if (selectedId != null && routes.none { it.id == selectedId }) selectedId = null
                checkNearby()
                redraw()
            }
        }
    }

    // šedé trasy kreslit první, roadbooky navrch
    private fun sortRoutes(list: List<AtlasRoute>) = list.sortedBy { if (it.hasRoadbook) 1 else 0 }

    /** Jsem u trasy s roadbookem (do 40 m)? Jednou se zeptám, jestli podle něj navigovat. */
    private fun checkNearby() {
        if (!hasFix || promptOpen || opening) return
        // trasy, od kterých jsem odjel dál než 200 m, se můžou zeptat znovu
        asked.removeAll { id -> (routes.firstOrNull { it.id == id }?.distanceM(lat, lon, 300.0) ?: 1e9) > 200.0 }
        var best: AtlasRoute? = null
        var bestD = 40.0
        for (r in routes) {
            if (!r.hasRoadbook || r.id in asked) continue
            val d = r.distanceM(lat, lon, 100.0)
            if (d < bestD) { bestD = d; best = r }
        }
        val r = best ?: return
        asked.add(r.id)
        selectRoute(r)
        promptOpen = true
        screenManager.push(RoadbookPromptScreen(carContext, r.name, r.rbState) { yes ->
            promptOpen = false
            if (yes) go() else redraw()
        })
    }

    private fun setZoom(z: Int) {
        zoom = z.coerceIn(8, 18)
        redraw()
    }

    private fun selectedRoute(): AtlasRoute? = selectedId?.let { id -> routes.firstOrNull { it.id == id } }

    /** Výběr trasy; u trasy bez roadbooku odhadne směr podle toho, ke kterému konci mám blíž. */
    private fun selectRoute(r: AtlasRoute?) {
        selectedId = r?.id
        if (r != null && !r.hasRoadbook && hasFix) {
            val n = r.lat.size - 1
            val dStart = cz.cenduroff.app.roadbook.haversine(lat, lon, r.lat[0], r.lon[0])
            val dEnd = cz.cenduroff.app.roadbook.haversine(lat, lon, r.lat[n], r.lon[n])
            autoReversed = dEnd < dStart
        } else {
            autoReversed = false
        }
    }

    private fun go() {
        val r = selectedRoute() ?: return
        val id = r.id
        if (opening) return
        opening = true
        loading = if (r.hasRoadbook) "Načítám roadbook" else "Počítám automatický roadbook z trasy"
        redraw()
        worker.execute {
            val rb = if (r.hasRoadbook) RoadbookRepo(carContext).load(id)
                     else Roadbook.generate(r.id, r.name, r.lat.indices.map { doubleArrayOf(r.lat[it], r.lon[it]) }, autoReversed)
            main.post {
                loading = null
                if (rb == null || rb.items.isEmpty()) {
                    opening = false
                    CarToast.makeText(carContext, "Roadbook se nepodařilo načíst.", CarToast.LENGTH_LONG).show()
                    redraw()
                } else {
                    screenManager.push(RoadbookNavScreen(carContext, rb))
                }
            }
        }
    }

    // ---------------- GPS (jen kvůli tomu, kde je mapa) ----------------
    private fun startGps() {
        val granted = ContextCompat.checkSelfPermission(carContext, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!granted) return
        try {
            locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let { lat = it.latitude; lon = it.longitude }
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper())
        } catch (e: Exception) {
        }
    }

    override fun onLocationChanged(location: Location) {
        lat = location.latitude
        lon = location.longitude
        hasFix = true
        checkNearby()
        redraw()
    }

    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}
    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

    // ---------------- klepnutí ----------------
    override fun onTap(x: Float, y: Float) {
        if (buttons.hit(x, y)) return
        val r = renderer.hitTest(x, y, routes)
        selectRoute(if (r != null && r.id != selectedId) r else null)
        redraw()
    }

    override fun onPinch(scaleFactor: Float) {
        scaleAcc *= scaleFactor
        if (scaleAcc > 1.5f) { scaleAcc = 1f; setZoom(zoom + 1) }
        else if (scaleAcc < 0.67f) { scaleAcc = 1f; setZoom(zoom - 1) }
    }

    override fun redraw() {
        val sel = selectedId?.let { id -> routes.firstOrNull { it.id == id } }
        val title = if (sel != null) "Trasa: " + sel.shortName() else "Vyber trasu na mapě"
        val subtitle = when {
            sel != null && sel.hasRoadbook -> "(" + stateLabel(sel.rbState) + ") · klepni na Jet ▶"
            sel != null -> "(Auto) z GPX · " + (if (autoReversed) "obráceně" else "od začátku") + " · Jet ▶"
            routes.isNotEmpty() -> "žlutá Ready · červená To check · fialová rozpracovaný · šedá Auto"
            else -> null
        }
        val st = AtlasRenderer.State(
            lat, lon, 0f, zoom, routes, selectedId, title, subtitle, null, message, loading,
            flat = true,
            routeColor = { r -> stateColors[r.rbState] ?: stateColors["auto"]!! },
            routeBold = { r -> r.hasRoadbook }
        )
        val btns = btnList()
        SurfaceHub.drawFull(this) { c, area, full ->
            c.drawColor(Color.BLACK)
            val u = min(area.height() / 480f, area.width() / 640f)
            val band = ButtonBar.topBand(full, area, u)
            renderer.draw(c, area, st, buttonsAtBottom = band == null)
            buttons.draw(c, band ?: renderer.buttonBox, btns, u, alignRight = false)
        }
    }
}
