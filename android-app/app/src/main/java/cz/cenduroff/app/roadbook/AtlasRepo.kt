package cz.cenduroff.app.roadbook

import android.content.Context
import cz.cenduroff.app.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.ln
import kotlin.math.sqrt
import kotlin.math.tan

/** Trasa pro Atlas v Android Auto: body v Mercatoru (0..1), aby se rychle kreslila. */
class AtlasRoute(
    val id: Int,
    val name: String,
    val type: String,
    val km: Double,
    val hasRoadbook: Boolean,
    val lat: DoubleArray,
    val lon: DoubleArray,
    /** Stav roadbooku: auto (bez uloženého, počítá se z GPX) / draft / ready / check (To check). */
    val rbState: String = "auto"
) {
    val rbReady: Boolean get() = rbState == "ready"

    val mx = DoubleArray(lat.size) { Merc.x(lon[it]) }
    val my = DoubleArray(lat.size) { Merc.y(lat[it]) }
    val minMx = mx.minOrNull() ?: 0.0
    val maxMx = mx.maxOrNull() ?: 0.0
    val minMy = my.minOrNull() ?: 0.0
    val maxMy = my.maxOrNull() ?: 0.0
    private val minLat = lat.minOrNull() ?: 0.0
    private val maxLat = lat.maxOrNull() ?: 0.0
    private val minLon = lon.minOrNull() ?: 0.0
    private val maxLon = lon.maxOrNull() ?: 0.0

    /** Vzdálenost bodu od trasy v metrech (přibližně, stačí na „jsem na trase“). */
    fun distanceM(la: Double, lo: Double, limit: Double = 5000.0): Double {
        val ky = 111320.0
        val kx = 111320.0 * cos(Math.toRadians(la))
        // rychlé vyřazení podle obdélníku kolem trasy
        val dLat = limit / ky
        val dLon = limit / kx
        if (la < minLat - dLat || la > maxLat + dLat || lo < minLon - dLon || lo > maxLon + dLon) return Double.MAX_VALUE
        var best = Double.MAX_VALUE
        for (i in 0 until lat.size - 1) {
            val ax = (lon[i] - lo) * kx
            val ay = (lat[i] - la) * ky
            val bx = (lon[i + 1] - lo) * kx
            val by = (lat[i + 1] - la) * ky
            val dx = bx - ax
            val dy = by - ay
            val len = dx * dx + dy * dy
            var t = if (len > 0) -(ax * dx + ay * dy) / len else 0.0
            t = t.coerceIn(0.0, 1.0)
            val px = ax + t * dx
            val py = ay + t * dy
            val d = px * px + py * py
            if (d < best) best = d
        }
        if (lat.size == 1) {
            val ax = (lon[0] - lo) * kx
            val ay = (lat[0] - la) * ky
            best = ax * ax + ay * ay
        }
        return sqrt(best)
    }

    /** Krátký název: první tři slova. */
    fun shortName(): String {
        val w = name.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        return if (w.size <= 3) w.joinToString(" ") else w.take(3).joinToString(" ") + "…"
    }
}

object Merc {
    fun x(lon: Double): Double = (lon + 180.0) / 360.0
    fun y(lat: Double): Double {
        val r = Math.toRadians(lat.coerceIn(-85.0, 85.0))
        return (1.0 - ln(tan(r) + 1.0 / cos(r)) / PI) / 2.0
    }
}

/**
 * Trasy pro Atlas v Android Auto. Se signálem ze serveru (a uloží se do telefonu),
 * bez signálu poslední uložená kopie. Blokující – volat mimo hlavní vlákno.
 */
class AtlasRepo(context: Context) {
    private val file = File(context.filesDir, "atlas_routes.json")

    private fun get(path: String): String {
        val c = URL(BuildConfig.API_URL + path).openConnection() as HttpURLConnection
        c.connectTimeout = 12000
        c.readTimeout = 30000
        c.setRequestProperty("Accept", "application/json")
        try {
            if (c.responseCode !in 200..299) throw IllegalStateException("HTTP ${c.responseCode}")
            return c.inputStream.bufferedReader(Charsets.UTF_8).use { it.readText() }
        } finally {
            c.disconnect()
        }
    }

    /** Trasy uložené v telefonu (rychlé, bez internetu); null = nic uloženého. */
    fun loadCached(): List<AtlasRoute>? = try {
        val rec = JSONObject(file.readText())
        parse(rec.getJSONArray("routes"), rec.optJSONArray("roadbooks") ?: JSONArray())
    } catch (e: Exception) {
        null
    }

    /** Čerstvé trasy ze serveru (a uloží se do telefonu); null = bez signálu / chyba. */
    fun loadOnline(): List<AtlasRoute>? = try {
        val routes = JSONArray(get("/api/routes"))
        val rb = try { JSONArray(get("/api/roadbooks")) } catch (e: Exception) { JSONArray() }
        val rec = JSONObject().put("routes", routes).put("roadbooks", rb).put("savedAt", System.currentTimeMillis())
        try { file.writeText(rec.toString()) } catch (e: Exception) {}
        parse(routes, rb)
    } catch (e: Exception) {
        null
    }

    private fun parse(routes: JSONArray, rbs: JSONArray): List<AtlasRoute> {
        val withRb = HashSet<Int>()
        val states = HashMap<Int, String>()
        for (i in 0 until rbs.length()) rbs.optJSONObject(i)?.let {
            val id = it.optInt("route_id")
            withRb.add(id)
            // novější server posílá „state“; u staršího se dopočítá
            states[id] = it.optString("state", "").ifBlank {
                when {
                    it.optBoolean("stale", false) -> "check"
                    it.optString("status") == "ready" -> "ready"
                    else -> "draft"
                }
            }
        }
        val out = ArrayList<AtlasRoute>()
        for (i in 0 until routes.length()) {
            val r = routes.optJSONObject(i) ?: continue
            val pts = r.optJSONArray("points") ?: continue
            if (pts.length() < 2) continue
            val la = DoubleArray(pts.length())
            val lo = DoubleArray(pts.length())
            for (k in 0 until pts.length()) {
                val p = pts.getJSONArray(k)
                la[k] = p.getDouble(0)
                lo[k] = p.getDouble(1)
            }
            val id = r.optInt("id")
            out.add(AtlasRoute(id, r.optString("name"), r.optString("route_type", "offroad"),
                r.optDouble("distance_km", 0.0), id in withRb, la, lo, states[id] ?: "auto"))
        }
        return out
    }
}
