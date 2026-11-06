package cz.cenduroff.app.roadbook

import android.content.Context
import org.json.JSONObject
import java.io.File

/**
 * Roadbooky uložené v telefonu (pro jízdu bez signálu a pro Android Auto).
 * Každá trasa = jeden soubor roadbooks/<id>.json ve formátu
 * { route: { id, name, distance_km, points }, roadbook: { status, stale, data: { settings, items } }, savedAt }
 * (stejný záznam, jaký si ukládá Roadbook NAVI na webu).
 */
class RoadbookStore(context: Context) {
    private val dir = File(context.filesDir, "roadbooks").apply { mkdirs() }

    fun save(routeId: Int, json: String) {
        try {
            JSONObject(json) // kontrola, že je to platný JSON
            File(dir, "$routeId.json").writeText(json)
        } catch (e: Exception) {
            // neplatná data se neukládají
        }
    }

    fun remove(routeId: Int) {
        File(dir, "$routeId.json").delete()
    }

    fun load(routeId: Int): JSONObject? = try {
        val f = File(dir, "$routeId.json")
        if (f.exists()) JSONObject(f.readText()) else null
    } catch (e: Exception) {
        null
    }

    /** Všechny uložené záznamy (id → JSON). */
    fun all(): List<JSONObject> =
        (dir.listFiles { f -> f.name.endsWith(".json") } ?: emptyArray())
            .mapNotNull { f -> try { JSONObject(f.readText()) } catch (e: Exception) { null } }
}
