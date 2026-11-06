package cz.cenduroff.app.car

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.constraints.ConstraintManager
import androidx.car.app.model.Action
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import cz.cenduroff.app.roadbook.AtlasRoute
import java.util.Locale

/** Atlas – výběr trasy: nahoře „Volná jízda“, pak trasy podle vzdálenosti ode mě. */
class AtlasRoutesScreen(
    carContext: CarContext,
    private val routes: List<AtlasRoute>,
    private val lat: Double,
    private val lon: Double,
    private val hasFix: Boolean,
    private val selectedId: Int?,
    private val onPick: (Int?) -> Unit
) : Screen(carContext) {

    private val cs = Locale("cs", "CZ")

    private fun listLimit(): Int = try {
        if (carContext.carAppApiLevel >= 2)
            carContext.getCarService(ConstraintManager::class.java).getContentLimit(ConstraintManager.CONTENT_LIMIT_TYPE_LIST)
        else 6
    } catch (e: Exception) {
        6
    }

    override fun onGetTemplate(): Template {
        val items = ItemList.Builder()
        items.addItem(
            Row.Builder()
                .setTitle(if (selectedId == null) "● Volná jízda" else "Volná jízda")
                .addText("chytá se nejbližší trasy sama")
                .setOnClickListener { onPick(null); screenManager.pop() }
                .build()
        )
        val sorted = if (hasFix)
            routes.map { it to it.distanceM(lat, lon, 1_000_000.0) }.sortedBy { it.second }
        else
            routes.map { it to Double.NaN }.sortedBy { it.first.name.lowercase() }
        for ((r, d) in sorted.take(listLimit() - 1)) {
            val dist = when {
                d.isNaN() -> ""
                d < 1000 -> " · ${d.toInt()} m od tebe"
                else -> " · " + String.format(cs, "%.1f km od tebe", d / 1000.0)
            }
            items.addItem(
                Row.Builder()
                    .setTitle((if (r.id == selectedId) "● " else "") + r.name)
                    .addText(String.format(cs, "%.1f km", r.km) + (if (r.hasRoadbook) " · roadbook" else "") + dist)
                    .setOnClickListener { onPick(r.id); screenManager.pop() }
                    .build()
            )
        }
        return ListTemplate.Builder()
            .setTitle("Vyber trasu")
            .setHeaderAction(Action.BACK)
            .setSingleList(items.build())
            .build()
    }
}
