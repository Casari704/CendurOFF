package cz.cenduroff.app.roadbook

import org.json.JSONArray
import org.json.JSONObject
import java.util.Locale
import kotlin.math.abs
import kotlin.math.asin
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin
import kotlin.math.sqrt

/*
 * Roadbook pro Android Auto – stejná data a pravidla jako public/rb-core.js na webu
 * (instrukce, poloha na trase, popisky, tvar tulipánů).
 */

private const val D2R = Math.PI / 180.0

fun haversine(aLat: Double, aLon: Double, bLat: Double, bLon: Double): Double {
    val dLat = (bLat - aLat) * D2R
    val dLon = (bLon - aLon) * D2R
    val s = sin(dLat / 2).let { it * it } + cos(aLat * D2R) * cos(bLat * D2R) * sin(dLon / 2).let { it * it }
    return 2 * 6371000.0 * asin(sqrt(s))
}

fun angleDiff(a: Double, b: Double): Double = ((a - b + 540.0) % 360.0) - 180.0

class RbItem(
    val id: String,
    var s: Double,
    val lat: Double,
    val lon: Double,
    val exit: Int,
    val sides: List<Int>,
    val round: Boolean,
    val icons: List<String>,
    val danger: Int,
    val road: String?,
    val note: String,
    val sub: String,
    val kind: String?,
    var cap: Int
) {
    var n: Int = 0
    var par: Double = 0.0
}

class Projection(val s: Double, val dist: Double)

/** Trasa převzorkovaná po 5 m + lokální souřadnice v metrech (pro rychlé hledání polohy). */
class RouteGeo(points: List<DoubleArray>, reversed: Boolean) {
    val lat: DoubleArray
    val lon: DoubleArray
    val s: DoubleArray
    private val x: DoubleArray
    private val y: DoubleArray
    val n: Int
    val total: Double
    private val kx: Double
    private val ky = 110540.0
    private val step = 5.0

    init {
        val raw = (if (reversed) points.reversed() else points)
        val pts = ArrayList<DoubleArray>()
        for (p in raw) {
            if (pts.isEmpty() || haversine(pts.last()[0], pts.last()[1], p[0], p[1]) > 0.5) pts.add(p)
        }
        require(pts.size >= 2) { "Trasa nemá dost bodů." }
        val lat0 = pts.sumOf { it[0] } / pts.size
        kx = 111320.0 * cos(lat0 * D2R)
        val la = ArrayList<Double>()
        val lo = ArrayList<Double>()
        val ss = ArrayList<Double>()
        la.add(pts[0][0]); lo.add(pts[0][1]); ss.add(0.0)
        var acc = 0.0
        var carry = 0.0
        for (i in 1 until pts.size) {
            val a = pts[i - 1]
            val b = pts[i]
            val d = haversine(a[0], a[1], b[0], b[1])
            var t = step - carry
            while (t <= d) {
                val f = t / d
                la.add(a[0] + (b[0] - a[0]) * f)
                lo.add(a[1] + (b[1] - a[1]) * f)
                ss.add(acc + t)
                t += step
            }
            carry = d - (t - step)
            acc += d
        }
        if (acc - ss.last() > 0.5) {
            la.add(pts.last()[0]); lo.add(pts.last()[1]); ss.add(acc)
        }
        lat = la.toDoubleArray()
        lon = lo.toDoubleArray()
        s = ss.toDoubleArray()
        n = s.size
        total = acc
        x = DoubleArray(n) { lon[it] * kx }
        y = DoubleArray(n) { lat[it] * ky }
    }

    /** Nejbližší místo na trase (volitelně jen v úseku from..to). */
    fun project(la: Double, lo: Double, from: Double? = null, to: Double? = null): Projection {
        val px = lo * kx
        val py = la * ky
        val i0 = if (from == null) 0 else max(0, floor(from / step).toInt() - 1)
        val i1 = if (to == null) n - 1 else min(n - 1, (to / step).toInt() + 2)
        var bestD = Double.MAX_VALUE
        var bestS = 0.0
        for (i in i0 until i1) {
            val r = segment(i, px, py)
            if (r.dist < bestD) { bestD = r.dist; bestS = r.s }
        }
        return Projection(bestS, bestD)
    }

    /** První poloha: u okruhu vybere místo nejblíž ZAČÁTKU trasy. */
    fun projectInitial(la: Double, lo: Double): Projection {
        val best = project(la, lo)
        val px = lo * kx
        val py = la * ky
        val limit = best.dist + 40.0
        for (i in 0 until n - 1) {
            val r = segment(i, px, py)
            if (r.dist <= limit) return r
        }
        return best
    }

    private fun segment(i: Int, px: Double, py: Double): Projection {
        val ax = x[i]; val ay = y[i]
        val dx = x[i + 1] - ax; val dy = y[i + 1] - ay
        val l2 = dx * dx + dy * dy
        var t = if (l2 > 0) ((px - ax) * dx + (py - ay) * dy) / l2 else 0.0
        t = t.coerceIn(0.0, 1.0)
        val d = hypot(px - (ax + dx * t), py - (ay + dy * t))
        return Projection(s[i] + (s[i + 1] - s[i]) * t, d)
    }

    /** Směr trasy (azimut ve stupních) mezi vzdálenostmi s0 → s1. */
    fun bearing(s0: Double, s1: Double): Double? {
        val a = idx(s0)
        val b = idx(s1)
        if (a == b) return null
        return (Math.toDegrees(atan2(x[b] - x[a], y[b] - y[a])) + 360.0) % 360.0
    }

    private fun idx(sv: Double): Int = (sv / step).roundToInt().coerceIn(0, n - 1)

    /**
     * Zatáčky z geometrie trasy – stejný postup jako detectTurns() v rb-core.js:
     * vyhlazení ±10 m, změna směru přes 25 m, úhel = součet změn přes celý oblouk.
     * Vrací dvojice (vzdálenost od začátku v m, úhel výjezdu ve stupních).
     */
    fun detectTurns(minAngle: Double = 30.0): List<Pair<Double, Int>> {
        val out = ArrayList<Pair<Double, Int>>()
        if (n < 12) return out
        val h = 2
        val sx = DoubleArray(n)
        val sy = DoubleArray(n)
        for (i in 0 until n) {
            var ax = 0.0; var ay = 0.0; var c = 0
            for (j in max(0, i - h)..min(n - 1, i + h)) { ax += x[j]; ay += y[j]; c++ }
            sx[i] = ax / c; sy[i] = ay / c
        }
        val k = (25.0 / step).roundToInt()
        val turn = DoubleArray(n)
        for (i in k until n - k) {
            val b1 = Math.toDegrees(atan2(sx[i] - sx[i - k], sy[i] - sy[i - k]))
            val b2 = Math.toDegrees(atan2(sx[i + k] - sx[i], sy[i + k] - sy[i]))
            turn[i] = angleDiff(b2, b1)
        }
        val cand = ArrayList<Int>()
        for (i in k until n - k) {
            val a = abs(turn[i])
            if (a < minAngle) continue
            if (a >= abs(turn[i - 1]) && a >= abs(turn[i + 1])) cand.add(i)
        }
        cand.sortByDescending { abs(turn[it]) }
        val head = DoubleArray(n)
        for (j in 1 until n) head[j] = Math.toDegrees(atan2(sx[j] - sx[j - 1], sy[j] - sy[j - 1]))
        class Region(val a: Int, val b: Int, val i: Int)
        val regions = ArrayList<Region>()
        for (i in cand) {
            if (regions.any { i >= it.a && i <= it.b }) continue
            val sg = Math.signum(turn[i])
            var a = i
            var b = i
            while (a > k && Math.signum(turn[a - 1]) == sg && abs(turn[a - 1]) >= 8) a--
            while (b < n - k - 1 && Math.signum(turn[b + 1]) == sg && abs(turn[b + 1]) >= 8) b++
            regions.add(Region(a, b, i))
        }
        for (r in regions.sortedBy { it.i }) {
            val j0 = max(2, r.a - 2)
            val j1 = min(n - 1, r.b + 2)
            var sum = 0.0
            for (j in j0..j1) sum += angleDiff(head[j], head[j - 1])
            var half = 0.0
            var iMid = r.i
            for (j in j0..j1) {
                half += angleDiff(head[j], head[j - 1])
                if (abs(half) >= abs(sum) / 2) { iMid = j; break }
            }
            val sv = s[iMid]
            if (sv < 15 || total - sv < 15) continue
            if (abs(sum) < minAngle) continue
            val ex = (Math.round(sum / 5.0) * 5).toInt().coerceIn(-180, 180)
            out.add(Pair(sv, ex))
        }
        return out
    }

    /** Bod trasy ve vzdálenosti sv (lat, lon). */
    fun pointAt(sv: Double): DoubleArray {
        val i = idx(sv)
        return doubleArrayOf(lat[i], lon[i])
    }
}

class Roadbook(val routeId: Int, val name: String, val geo: RouteGeo, val items: List<RbItem>, val ready: Boolean) {

    companion object {
        /** Záznam ve formátu webu: { route: {id, name, points}, roadbook: {status, stale, data} }. */
        fun fromRecord(rec: JSONObject): Roadbook? {
            return try {
            val route = rec.getJSONObject("route")
            val rb = rec.optJSONObject("roadbook") ?: return null
            val data = rb.optJSONObject("data") ?: return null
            val settings = data.optJSONObject("settings")
            val reversed = settings?.optBoolean("reversed", false) ?: false
            val stale = rb.optBoolean("stale", false)
            val pts = route.getJSONArray("points")
            val points = ArrayList<DoubleArray>(pts.length())
            for (i in 0 until pts.length()) {
                val p = pts.getJSONArray(i)
                points.add(doubleArrayOf(p.getDouble(0), p.getDouble(1)))
            }
            val geo = RouteGeo(points, reversed)
            val arr = data.optJSONArray("items") ?: JSONArray()
            val items = ArrayList<RbItem>()
            for (i in 0 until arr.length()) {
                val o = arr.getJSONObject(i)
                if (o.optBoolean("deleted", false)) continue
                val kind = if (o.isNull("kind")) null else o.optString("kind", "").ifBlank { null }
                val item = RbItem(
                    id = o.optString("id", "i$i"),
                    s = o.optDouble("s", 0.0),
                    lat = o.optDouble("lat", 0.0),
                    lon = o.optDouble("lon", 0.0),
                    exit = o.optInt("exit", 0),
                    sides = o.optJSONArray("sides")?.let { a -> (0 until a.length()).map { a.optInt(it) } } ?: emptyList(),
                    round = o.optBoolean("round", false),
                    icons = o.optJSONArray("icons")?.let { a -> (0 until a.length()).map { a.optString(it) } } ?: emptyList(),
                    danger = o.optInt("danger", 0),
                    road = if (o.isNull("road")) null else o.optString("road", "").ifBlank { null },
                    note = o.optString("note", ""),
                    sub = o.optString("sub", ""),
                    kind = kind,
                    cap = o.optInt("cap", 0)
                )
                // trasa se od uložení změnila → instrukce posunout na nejbližší místo nové trasy
                if (stale) {
                    item.s = when (kind) {
                        "start" -> 0.0
                        "finish" -> geo.total
                        else -> geo.project(item.lat, item.lon).s
                    }
                }
                items.add(item)
            }
            items.sortBy { it.s }
            items.forEachIndexed { i, item ->
                item.n = i + 1
                item.par = if (i == 0) 0.0 else item.s - items[i - 1].s
            }
            Roadbook(route.getInt("id"), route.optString("name", "Trasa"), geo, items, rb.optString("status") == "ready" && !stale)
            } catch (e: Exception) {
                null
            }
        }

        /**
         * Automatický roadbook jen z geometrie trasy (jako „Jet bez roadbooku“ na webu):
         * zatáčky nad 30°, start a cíl, instrukce blíž než 20 m sloučené.
         */
        fun generate(routeId: Int, name: String, points: List<DoubleArray>, reversed: Boolean): Roadbook? {
            return try {
                val geo = RouteGeo(points, reversed)
                fun mk(i: Int, sv: Double, exit: Int, kind: String?): RbItem {
                    val p = geo.pointAt(sv)
                    return RbItem("a$i", sv, p[0], p[1], exit, emptyList(), false, emptyList(), 0, null, "", "", kind, 0)
                }
                val raw = ArrayList<RbItem>()
                geo.detectTurns(30.0).forEachIndexed { i, t ->
                    if (t.first > 10 && geo.total - t.first > 10) raw.add(mk(i, t.first, t.second, null))
                }
                raw.add(mk(-1, 0.0, 0, "start"))
                raw.add(mk(-2, geo.total, 0, "finish"))
                raw.sortBy { it.s }
                val items = ArrayList<RbItem>()
                for (it in raw) {
                    val m = items.lastOrNull()
                    if (m != null && it.s - m.s < 20 && it.kind == null && m.kind == null) {
                        if (abs(it.exit) > abs(m.exit)) items[items.size - 1] = RbItem(m.id, m.s, m.lat, m.lon, it.exit, emptyList(), false, emptyList(), 0, null, "", "", null, 0)
                        continue
                    }
                    items.add(it)
                }
                items.forEachIndexed { i, item ->
                    item.cap = geo.bearing(item.s, min(geo.total, item.s + 40.0))?.roundToInt()?.rem(360) ?: 0
                    item.n = i + 1
                    item.par = if (i == 0) 0.0 else item.s - items[i - 1].s
                }
                Roadbook(routeId, name, geo, items, false)
            } catch (e: Exception) {
                null
            }
        }

        // ---- popisky (stejně jako na webu) ----
        val ROADS = mapOf(
            "asfalt" to "asfalt", "sotolina" to "šotolina", "lesni" to "lesní cesta",
            "polni" to "polní cesta", "pesina" to "pěšina", "mimo" to "mimo cestu"
        )

        fun dirName(exit: Int, round: Boolean): String {
            if (round) return "Kruhový objezd"
            val a = abs(exit)
            val side = if (exit < 0) "vlevo" else "vpravo"
            return when {
                a <= 20 -> "Rovně"
                a <= 60 -> "Mírně $side"
                a <= 110 -> side.replaceFirstChar { it.uppercase() }
                a <= 150 -> "Ostře $side"
                else -> "Vracák $side"
            }
        }

        fun label(item: RbItem): String = when {
            item.note.isNotBlank() -> item.note.trim()
            item.kind == "start" -> "Start"
            item.kind == "finish" -> "Cíl"
            else -> dirName(item.exit, item.round)
        }

        fun subLabel(item: RbItem): String {
            if (item.sub.isNotBlank()) return item.sub.trim()
            val parts = ArrayList<String>()
            if (item.round) parts.add("kruhový objezd") else if (item.sides.isNotEmpty()) parts.add("křižovatka")
            for (k in item.icons) {
                val name = Icons.NAMES[k]
                if (name != null && k != "kameni") parts.add(name.lowercase())
            }
            val roadName = item.road?.let { r -> ROADS[r] }
            if (roadName != null) parts.add(roadName)
            return parts.joinToString(", ")
        }

        val DANGER = arrayOf("", "!", "!!", "!!!")

        private val CS = Locale("cs", "CZ")
        fun fmtKm(m: Double): String = String.format(CS, "%.2f", max(0.0, m) / 1000.0)
        fun fmtDist(m: Double): String = when {
            m >= 10000 -> String.format(CS, "%.1f km", m / 1000.0)
            m >= 1000 -> String.format(CS, "%.2f km", m / 1000.0)
            else -> "${(max(0.0, m) / 10.0).roundToInt() * 10} m"
        }
    }
}

/** Ikony a tulipány jako SVG cesty (stejné jako na webu) – kreslí je RoadbookRenderer. */
object Icons {
    val PATHS = mapOf(
        "brod" to "M3 15c2 0 2-1.5 4.5-1.5S10 15 12 15s2-1.5 4.5-1.5S19 15 21 15M3 19c2 0 2-1.5 4.5-1.5S10 19 12 19s2-1.5 4.5-1.5S19 19 21 19M12 3l-3.5 6a3.5 3.5 0 0 0 7 0z",
        "most" to "M2 16h20M4 16v4M20 16v4M2 12c4 0 6-4 10-4s6 4 10 4M7 10.5V16M12 8v8M17 10.5V16",
        "zavora" to "M4 21V6M4 9h17v4H4M9 9l-3 4M14 9l-3 4M19 9l-3 4",
        "prejezd" to "M5 4l14 14M19 4L5 18M12 18v4",
        "obec" to "M3 11l9-7 9 7M5 10v10h14V10M10 20v-6h4v6",
        "benzinka" to "M4 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 21h12M4 10h10M14 8l3 3v6a1.5 1.5 0 0 0 3 0V9l-3-3",
        "vyhled" to "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6",
        "parkoviste" to "M5 3h14v18H5zM10 17V7h3a3 3 0 0 1 0 6h-3",
        "bivak" to "M2 20h20M4 20L12 5l8 15M12 20l-3.5-6M12 20l3.5-6",
        "kameni" to "M2 19l3-6 4 1 3-5 4 4 2-2 4 8z",
        "blato" to "M3 16c2-2 4-2 6 0s4 2 6 0 4-2 6 0M3 20c2-2 4-2 6 0s4 2 6 0 4-2 6 0M6 11h1M11 9h1M16 11h1",
        "pisek" to "M3 19h18M4 15h1M8 14h1M12 15h1M16 14h1M20 15h1M6 11h1M10 10h1M14 11h1M18 10h1",
        "vystup" to "M3 20h18M3 20L20 6M20 6h-6M20 6v6",
        "sjezd" to "M3 20h18M4 6l16 12M20 18h-6M20 18v-6",
        "uzky" to "M6 3v18M18 3v18M9 12h6M11 10l-2 2 2 2M13 10l2 2-2 2",
        "stromy" to "M2 18l20-7M7 16.2V21M17 12.6V21M12 9l2 3M15 7l1 4",
        "zver" to "M12 21c-3 0-5-2-5-5 0-2 2-4 5-4s5 2 5 4c0 3-2 5-5 5zM5 9.5h2M17 9.5h2M8.5 5.5h2M13.5 5.5h2"
    )
    val NAMES = mapOf(
        "brod" to "Brod", "most" to "Most", "zavora" to "Závora", "prejezd" to "Přejezd", "obec" to "Obec",
        "benzinka" to "Benzínka", "vyhled" to "Výhled", "parkoviste" to "Parkoviště", "bivak" to "Bivak",
        "kameni" to "Kamení", "blato" to "Bláto", "pisek" to "Písek", "vystup" to "Strmý výstup",
        "sjezd" to "Strmý sjezd", "uzky" to "Úzký průjezd", "stromy" to "Padlé stromy", "zver" to "Zvěř"
    )

    class Tulip(val main: String, val head: String, val side: String)

    private fun f(v: Double) = String.format(Locale.US, "%.1f", v)

    /** Tvar tulipánu ve viewBoxu 0 0 100 100 (vjezd dole uprostřed), stejně jako RB.tulipGeom. */
    fun tulip(exitDeg: Int, sides: List<Int>, round: Boolean): Tulip {
        fun dir(a: Double) = doubleArrayOf(sin(a * D2R), -cos(a * D2R))
        val r0 = if (round) 14.0 else 0.0
        val side = sides.joinToString(" ") { a ->
            val d = dir(a.toDouble())
            "M${f(50 + d[0] * r0)} ${f(50 + d[1] * r0)} L${f(50 + d[0] * 36)} ${f(50 + d[1] * 36)}"
        }
        val exit = exitDeg.toDouble()
        if (!round && abs(exit) > 150) {
            val sg = if (exit > 0) 1 else -1
            val xe = 50 + sg * 30
            val sw = if (sg > 0) 1 else 0
            return Tulip("M50 90 L50 42 A15 15 0 0 $sw $xe 42 L$xe 62", "M${xe - 8} 62 L$xe 78 L${xe + 8} 62 Z", side)
        }
        val d = dir(exit)
        val ex = 50 + d[0] * 40
        val ey = 50 + d[1] * 40
        val px = -d[1]
        val py = d[0]
        val bx = ex - d[0] * 13
        val by = ey - d[1] * 13
        val main = if (round)
            "M50 90 L50 64 M64 50 A14 14 0 1 0 36 50 A14 14 0 1 0 64 50 M${f(50 + d[0] * 14)} ${f(50 + d[1] * 14)} L${f(bx)} ${f(by)}"
        else "M50 90 L50 50 L${f(bx)} ${f(by)}"
        val head = "M${f(bx + px * 8)} ${f(by + py * 8)} L${f(ex)} ${f(ey)} L${f(bx - px * 8)} ${f(by - py * 8)} Z"
        return Tulip(main, head, side)
    }
}
