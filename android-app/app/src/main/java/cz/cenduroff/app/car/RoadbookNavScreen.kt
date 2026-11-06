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
import android.os.SystemClock
import android.os.Looper
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarIcon
import androidx.car.app.model.Template
import androidx.car.app.navigation.NavigationManager
import androidx.car.app.navigation.NavigationManagerCallback
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.core.content.ContextCompat
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import cz.cenduroff.app.R
import cz.cenduroff.app.roadbook.Roadbook
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Android Auto – jízda podle roadbooku. Displej kreslí RoadbookRenderer (varianta 3),
 * poloha jde z GPS telefonu. Tlačítka −50 m / +50 m / Zpět jsou nakreslená ve žlutém pruhu
 * (svítí pořád); stejné volby má i lišta Android Auto (ta se po chvíli schová).
 */
class RoadbookNavScreen(carContext: CarContext, private val rb: Roadbook) :
    Screen(carContext), SurfaceHub.Target, LocationListener {

    private val renderer = RoadbookRenderer()

    private var prog: Double? = null      // poloha na trase (m)
    private var offset = 0.0              // korekce počítadla (±50 m)
    private var offRoute: Double? = null
    private var cap: Int? = null
    private var message: String? = null

    // animace posunu roadbooku
    private val main = Handler(Looper.getMainLooper())
    private var shownIdx: Int? = null
    private var animFrom: Int? = null
    private var animStart = 0L
    private val animMs = 650L
    private val frame = object : Runnable {
        override fun run() {
            redraw()
            if (animFrom != null) main.postDelayed(this, 33)
        }
    }

    private val buttons = ButtonBar()
    private val btnList = listOf(
        ButtonBar.Btn("−50 m") { offset -= 50.0; redraw() },
        ButtonBar.Btn("+50 m") { offset += 50.0; redraw() },
        ButtonBar.Btn("Zpět") { screenManager.popToRoot() }
    )

    private val locationManager = carContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager

    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onCreate(owner: LifecycleOwner) {
                startNavigation()
                startGps()
            }

            override fun onStart(owner: LifecycleOwner) {
                SurfaceHub.attach(carContext, this@RoadbookNavScreen)
            }

            override fun onDestroy(owner: LifecycleOwner) {
                main.removeCallbacks(frame)
                stopGps()
                stopNavigation()
                SurfaceHub.detach(this@RoadbookNavScreen)
            }
        })
    }

    // ---------------- šablona: jen tlačítka, zbytek kreslíme sami ----------------
    // lišta Android Auto musí mít aspoň jedno tlačítko – jen „zpět na dlaždice“, zbytek kreslíme sami
    override fun onGetTemplate(): Template {
        val home = Action.Builder()
            .setIcon(CarIcon.Builder(IconCompat.createWithResource(carContext, R.drawable.ic_car_home)).build())
            .setOnClickListener { screenManager.popToRoot() }
            .build()
        return NavigationTemplate.Builder()
            .setActionStrip(ActionStrip.Builder().addAction(home).build())
            .build()
    }

    // ---------------- navigace (Android Auto ví, že běží naše navigace) ----------------
    private fun startNavigation() {
        try {
            val nav = carContext.getCarService(NavigationManager::class.java)
            nav.setNavigationManagerCallback(object : NavigationManagerCallback {
                override fun onStopNavigation() {
                    screenManager.popToRoot()
                }

                override fun onAutoDriveEnabled() {}
            })
            nav.navigationStarted()
        } catch (e: Exception) {
            // starší Android Auto – roadbook funguje i bez toho
        }
    }

    private fun stopNavigation() {
        try {
            val nav = carContext.getCarService(NavigationManager::class.java)
            nav.navigationEnded()
            nav.clearNavigationManagerCallback()
        } catch (e: Exception) {
        }
    }

    // ---------------- GPS ----------------
    private fun startGps() {
        val granted = ContextCompat.checkSelfPermission(carContext, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (!granted) {
            message = "Povol polohu v aplikaci CendurOFF v telefonu"
            redraw()
            return
        }
        try {
            locationManager.requestLocationUpdates(LocationManager.GPS_PROVIDER, 1000L, 0f, this, Looper.getMainLooper())
        } catch (e: SecurityException) {
            message = "Povol polohu v aplikaci CendurOFF v telefonu"
        } catch (e: IllegalArgumentException) {
            message = "Telefon nemá GPS"
        }
        redraw()
    }

    private fun stopGps() {
        try {
            locationManager.removeUpdates(this)
        } catch (e: Exception) {
        }
    }

    override fun onLocationChanged(location: Location) {
        val geo = rb.geo
        val la = location.latitude
        val lo = location.longitude
        // první poloha: u okruhu začátek trasy, daleko od trasy = start
        if (prog == null) {
            val p0 = geo.projectInitial(la, lo)
            prog = if (p0.dist > 300) 0.0 else p0.s
        }
        val last = prog ?: 0.0
        var p = geo.project(la, lo, max(0.0, last - 200.0), min(geo.total, last + 1500.0))
        if (p.dist > 40) {
            val g = geo.project(la, lo)
            if (g.dist + 15 < p.dist) p = g
        }
        if (p.dist > 50) {
            offRoute = p.dist
        } else {
            offRoute = null
            prog = p.s
        }
        cap = if (location.hasBearing() && location.hasSpeed() && location.speed > 1.5f) {
            location.bearing.roundToInt() % 360
        } else {
            geo.bearing(odo(), min(geo.total, odo() + 30.0))?.roundToInt()
        }
        message = null
        redraw()
    }

    // starší Androidy (< 11) tyhle metody vyžadují
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {
        message = "Zapni v telefonu polohu (GPS)"
        redraw()
    }
    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

    private fun odo(): Double = ((prog ?: 0.0) + offset).coerceIn(0.0, rb.geo.total)

    // ---------------- kreslení ----------------
    override fun onTap(x: Float, y: Float) {
        buttons.hit(x, y)
    }

    override fun redraw() {
        val hasFix = prog != null
        val odoNow = odo()
        // změnila se aktuální instrukce → spustit animaci posunu
        val idx = RoadbookRenderer.currentIndex(rb.items, odoNow, hasFix)
        val now = SystemClock.uptimeMillis()
        val prevShown = shownIdx
        if (prevShown != null && prevShown != idx) {
            animFrom = prevShown
            animStart = now
            main.removeCallbacks(frame)
            main.postDelayed(frame, 33)
        }
        shownIdx = idx
        var t = 1f
        if (animFrom != null) {
            t = ((now - animStart).toFloat() / animMs).coerceIn(0f, 1f)
            if (t >= 1f) animFrom = null
        }
        val st = RoadbookRenderer.State(
            roadbook = rb,
            odo = odoNow,
            hasFix = hasFix,
            capDeg = cap,
            offRouteM = offRoute,
            message = message,
            animFrom = animFrom,
            animT = t
        )
        SurfaceHub.drawFull(this) { c, area, full ->
            c.drawColor(Color.BLACK)
            renderer.draw(c, area, st)
            val u = kotlin.math.min(area.height() / 480f, area.width() / 640f)
            // tlačítka nahoře v pruhu vedle lišty Android Auto; když tam pruh není, ve žlutém pruhu
            val band = ButtonBar.topBand(full, area, u)
            buttons.draw(c, band ?: renderer.buttonBox, btnList, u, alignRight = band == null)
        }
    }
}
