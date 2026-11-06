package cz.cenduroff.app.car

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
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
import cz.cenduroff.app.roadbook.angleDiff
import java.util.concurrent.Executors
import kotlin.math.abs
import kotlin.math.max

/**
 * Android Auto – Navigace ATLAS. Volná jízda: mapa se všemi trasami a moje poloha;
 * aplikace sama „chytí“ nejbližší trasu, a když má roadbook, ukáže v rohu další instrukci.
 * Klepnutím na trasu (nebo tlačítkem Trasy) se vybere konkrétní trasa: nahoře „Trasa: …“.
 */
class AtlasScreen(carContext: CarContext) : Screen(carContext), SurfaceHub.Target, LocationListener {

    private val main = Handler(Looper.getMainLooper())
    private val worker = Executors.newSingleThreadExecutor()
    private val tiles = TileCache(carContext) { redraw() }
    private val renderer = AtlasRenderer(tiles)

    private var routes: List<AtlasRoute> = emptyList()
    private var online = true
    private var loaded = false
    private var loading: String? = null      // text velkého okna „Načítám…“
    private var updating = false             // na pozadí se stahují čerstvé trasy

    // tlačítka kreslená do mapy (svítí pořád)
    private val buttons = ButtonBar()
    private val btnList = listOf(
        ButtonBar.Btn("Trasy") { openList() },
        ButtonBar.Btn("−3") { setZoom(zoom - 3) },
        ButtonBar.Btn("−") { setZoom(zoom - 1) },
        ButtonBar.Btn("+") { setZoom(zoom + 1) },
        ButtonBar.Btn("+3") { setZoom(zoom + 3) },
        ButtonBar.Btn("Zpět") { screenManager.popToRoot() }
    )

    private var lat = 49.87
    private var lon = 17.87
    private var hasFix = false
    private var heading = 0f
    private var zoom = 15
    private var scaleAcc = 1f

    private var selectedId: Int? = null     // vybraná klepnutím / ze seznamu
    private var caughtId: Int? = null       // chycená automaticky (nejbližší)
    private val rbCache = HashMap<Int, Roadbook?>()
    private val rbLoading = HashSet<Int>()
    private var message: String? = null

    private val locationManager = carContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onCreate(owner: LifecycleOwner) {
                startGps()
                loadRoutes()
            }

            override fun onStart(owner: LifecycleOwner) {
                SurfaceHub.attach(carContext, this@AtlasScreen)
            }

            override fun onDestroy(owner: LifecycleOwner) {
                stopGps()
                tiles.shutdown()
                SurfaceHub.detach(this@AtlasScreen)
            }
        })
    }

    /** Nejdřív trasy uložené v telefonu (hned), pak čerstvé ze serveru na pozadí. */
    private fun loadRoutes() {
        loading = "Načítám trasy uložené v telefonu"
        worker.execute {
            val repo = AtlasRepo(carContext)
            val cached = repo.loadCached()
            main.post {
                if (cached != null && cached.isNotEmpty()) {
                    routes = cached
                    loaded = true
                    loading = null
                    updating = true
                } else {
                    loading = "Stahuji trasy ze serveru (poprvé to chvíli trvá)"
                }
                updateCatch()
                redraw()
            }
            val fresh = repo.loadOnline()
            main.post {
                updating = false
                if (fresh != null) {
                    routes = fresh
                    online = true
                } else {
                    online = false
                }
                loaded = true
                loading = null
                if (routes.isEmpty()) message = if (online) "Zatím tu nejsou žádné trasy" else "Offline – trasy nejsou uložené"
                updateCatch()
                redraw()
            }
        }
    }

    // ---------------- tlačítka ----------------
    // lišta Android Auto musí mít aspoň jedno tlačítko – necháme jen „zpět na dlaždice“,
    // ostatní tlačítka kreslíme sami vedle ní (svítí pořád)
    override fun onGetTemplate(): Template {
        val home = Action.Builder()
            .setIcon(CarIcon.Builder(IconCompat.createWithResource(carContext, R.drawable.ic_car_home)).build())
            .setOnClickListener { screenManager.popToRoot() }
            .build()
        return NavigationTemplate.Builder()
            .setActionStrip(ActionStrip.Builder().addAction(home).build())
            .build()
    }

    private fun setZoom(z: Int) {
        zoom = z.coerceIn(11, 18)
        redraw()
    }

    private fun openList() {
        if (!loaded) {
            CarToast.makeText(carContext, "Načítám trasy…", CarToast.LENGTH_SHORT).show()
            return
        }
        screenManager.push(AtlasRoutesScreen(carContext, routes, lat, lon, hasFix, selectedId) { id ->
            select(id)
        })
    }

    private fun select(id: Int?) {
        selectedId = id
        id?.let { ensureRoadbook(it) }
        redraw()
    }

    // ---------------- GPS ----------------
    private fun startGps() {
        val granted = ContextCompat.checkSelfPermission(carContext, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            message = "Povol polohu v aplikaci CendurOFF v telefonu"
            return
        }
        try {
            locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)?.let { lat = it.latitude; lon = it.longitude }
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper())
            message = "Čekám na GPS…"
        } catch (e: SecurityException) {
            message = "Povol polohu v aplikaci CendurOFF v telefonu"
        } catch (e: IllegalArgumentException) {
            message = "Telefon nemá GPS"
        }
    }

    private fun stopGps() {
        try { locationManager.removeUpdates(this) } catch (e: Exception) {}
    }

    override fun onLocationChanged(location: Location) {
        lat = location.latitude
        lon = location.longitude
        hasFix = true
        if (location.hasBearing() && location.hasSpeed() && location.speed > 1.5f) heading = location.bearing
        if (message == "Čekám na GPS…") message = null
        updateCatch()
        redraw()
    }

    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {
        message = "Zapni v telefonu polohu (GPS)"
        redraw()
    }
    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

    /** Automatické chycení nejbližší trasy (do 40 m; pustí se až nad 90 m). */
    private fun updateCatch() {
        if (!hasFix || routes.isEmpty()) return
        val cur = caughtId?.let { id -> routes.firstOrNull { it.id == id } }
        if (cur != null && cur.distanceM(lat, lon, 200.0) < 90.0) return
        var best: AtlasRoute? = null
        var bestD = 40.0
        for (r in routes) {
            val d = r.distanceM(lat, lon, 100.0)
            // trasy s roadbookem mají přednost, když jsou skoro stejně blízko
            val dd = if (r.hasRoadbook) d - 10.0 else d
            if (dd < bestD) { bestD = dd; best = r }
        }
        caughtId = best?.id
        best?.let { ensureRoadbook(it.id) }
    }

    private fun ensureRoadbook(id: Int) {
        val r = routes.firstOrNull { it.id == id } ?: return
        if (!r.hasRoadbook || rbCache.containsKey(id) || !rbLoading.add(id)) return
        worker.execute {
            val rb = RoadbookRepo(carContext).load(id)
            main.post {
                rbLoading.remove(id)
                rbCache[id] = rb
                redraw()
            }
        }
    }

    /** Roh s další instrukcí roadbooku (jen když jsem na trase a jedu po směru). */
    private fun corner(activeId: Int?): AtlasRenderer.Corner? {
        val id = activeId ?: return null
        if (!hasFix) return null
        val rb = rbCache[id] ?: return null
        val p = rb.geo.project(lat, lon)
        if (p.dist > 60.0) return null
        val dirOfRoute = rb.geo.bearing(p.s, minOf(rb.geo.total, p.s + 40.0))
        if (dirOfRoute != null && abs(angleDiff(heading.toDouble(), dirOfRoute)) > 110.0 && heading != 0f) {
            return AtlasRenderer.Corner(null, "", "", "Jedeš proti směru roadbooku")
        }
        val next = rb.items.firstOrNull { it.s > p.s + 8.0 } ?: return null
        return AtlasRenderer.Corner(next, Roadbook.fmtDist(max(0.0, next.s - p.s)), Roadbook.label(next).uppercase(), null)
    }

    // klepnutí na mapu = vybrat trasu (Android Auto od verze API 5)
    // klepnutí: tlačítko → trasa (vybrat) → prázdné místo (zpět do volné jízdy)
    override fun onTap(x: Float, y: Float) {
        if (buttons.hit(x, y)) return
        val r = renderer.hitTest(x, y, routes)
        if (r != null && r.id != selectedId) {
            select(r.id)
            CarToast.makeText(carContext, "Trasa: " + r.shortName(), CarToast.LENGTH_SHORT).show()
        } else if (selectedId != null) {
            select(null)
            CarToast.makeText(carContext, "Volná jízda", CarToast.LENGTH_SHORT).show()
        }
    }

    // roztažení / stažení prsty = přiblížení
    override fun onPinch(scaleFactor: Float) {
        scaleAcc *= scaleFactor
        if (scaleAcc > 1.5f) { scaleAcc = 1f; setZoom(zoom + 1) }
        else if (scaleAcc < 0.67f) { scaleAcc = 1f; setZoom(zoom - 1) }
    }

    override fun redraw() {
        val activeId = selectedId ?: caughtId
        val sel = selectedId?.let { id -> routes.firstOrNull { it.id == id } }
        val caught = caughtId?.let { id -> routes.firstOrNull { it.id == id } }
        val title = if (sel != null) "Trasa: " + sel.shortName() else "Volná jízda"
        val subtitle = when {
            sel == null && caught != null -> "na trase: " + caught.shortName()
            updating -> "aktualizuji trasy…"
            loaded && !online -> "offline – uložené trasy"
            else -> null
        }
        val st = AtlasRenderer.State(lat, lon, heading, zoom, routes, activeId, title, subtitle, corner(activeId), message, loading)
        SurfaceHub.drawFull(this) { c, area, full ->
            c.drawColor(android.graphics.Color.BLACK)
            val u = kotlin.math.min(area.height() / 480f, area.width() / 640f)
            val band = ButtonBar.topBand(full, area, u)
            renderer.draw(c, area, st, buttonsAtBottom = band == null)
            // tlačítka nahoře v pruhu vedle lišty Android Auto; když tam pruh není, dole v mapě
            buttons.draw(c, band ?: renderer.buttonBox, btnList, u, alignRight = false)
        }
    }
}
