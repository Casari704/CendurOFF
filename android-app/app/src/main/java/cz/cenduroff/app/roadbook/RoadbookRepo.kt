package cz.cenduroff.app.roadbook

import android.content.Context
import cz.cenduroff.app.BuildConfig
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * Roadbooky pro Android Auto: se signálem ze serveru (a rovnou se uloží do telefonu),
 * bez signálu z telefonu. Čtení tras a roadbooků nepotřebuje přihlášení.
 * Všechny metody jsou blokující – volat mimo hlavní vlákno.
 */
class RoadbookRepo(context: Context) {

    class Entry(val routeId: Int, val name: String, val km: Double, val state: String, val offline: Boolean) {
        val ready: Boolean get() = state == "ready"
        val stateLabel: String get() = when (state) {
            "ready" -> "Ready"; "check" -> "To check"; "draft" -> "Rozpracovaný"; else -> "Auto"
        }
    }

    private val store = RoadbookStore(context)

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

    /** Seznam tras s roadbookem: READY nahoře. Bez signálu jen uložené v telefonu. */
    fun list(): Pair<List<Entry>, Boolean> {
        val offlineIds = store.all().mapNotNull { it.optJSONObject("route")?.optInt("id") }.toSet()
        return try {
            val sums = JSONArray(get("/api/roadbooks"))
            val status = HashMap<Int, String>()
            for (i in 0 until sums.length()) {
                val o = sums.getJSONObject(i)
                status[o.getInt("route_id")] = o.optString("state", "").ifBlank {
                    when {
                        o.optBoolean("stale", false) -> "check"
                        o.optString("status") == "ready" -> "ready"
                        else -> "draft"
                    }
                }
            }
            val routes = JSONArray(get("/api/routes"))
            cachedRoutes.clear()
            val out = ArrayList<Entry>()
            for (i in 0 until routes.length()) {
                val r = routes.getJSONObject(i)
                val id = r.getInt("id")
                cachedRoutes[id] = r
                val ready = status[id] ?: continue
                out.add(Entry(id, r.optString("name"), r.optDouble("distance_km", 0.0), ready, id in offlineIds))
            }
            Pair(sortEntries(out), true)
        } catch (e: Exception) {
            val out = store.all().mapNotNull { rec ->
                val route = rec.optJSONObject("route") ?: return@mapNotNull null
                val rb = rec.optJSONObject("roadbook") ?: return@mapNotNull null
                Entry(route.optInt("id"), route.optString("name"), route.optDouble("distance_km", 0.0),
                    when {
                        rb.optBoolean("stale", false) || rb.optInt("review_count", 0) > 0 -> "check"
                        rb.optString("status") == "ready" -> "ready"
                        else -> "draft"
                    }, true)
            }
            Pair(sortEntries(out), false)
        }
    }

    private fun sortEntries(list: List<Entry>) =
        list.sortedWith(compareBy<Entry>({ listOf("ready", "check", "draft").indexOf(it.state).let { i -> if (i < 0) 9 else i } }, { it.name.lowercase() }))

    /** Roadbook k jízdě: čerstvý ze serveru (a uloží se), jinak uložený v telefonu. */
    fun load(routeId: Int): Roadbook? {
        try {
            val res = JSONObject(get("/api/roadbooks/$routeId"))
            val rb = res.optJSONObject("roadbook")
            var route = cachedRoutes[routeId]
            if (route == null) {
                route = JSONObject(get("/api/routes/$routeId")).getJSONObject("route")
            }
            if (rb != null && route != null) {
                val rec = JSONObject()
                rec.put("route", JSONObject().apply {
                    put("id", route.getInt("id"))
                    put("name", route.optString("name"))
                    put("distance_km", route.optDouble("distance_km", 0.0))
                    put("points", route.getJSONArray("points"))
                })
                rec.put("roadbook", rb)
                rec.put("savedAt", System.currentTimeMillis())
                store.save(routeId, rec.toString())
                Roadbook.fromRecord(rec)?.let { return it }
            }
        } catch (e: Exception) {
            // bez signálu → uložená kopie
        }
        return store.load(routeId)?.let { Roadbook.fromRecord(it) }
    }

    companion object {
        // poslední stažený seznam tras (s body) – ať se při výběru nestahuje znovu
        private val cachedRoutes = HashMap<Int, JSONObject>()
    }
}
