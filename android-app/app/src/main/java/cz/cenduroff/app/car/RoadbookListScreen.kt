package cz.cenduroff.app.car

import android.os.Handler
import android.os.Looper
import androidx.car.app.CarContext
import androidx.car.app.CarToast
import androidx.car.app.Screen
import androidx.car.app.constraints.ConstraintManager
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.ItemList
import androidx.car.app.model.ListTemplate
import androidx.car.app.model.Row
import androidx.car.app.model.Template
import cz.cenduroff.app.roadbook.RoadbookRepo
import java.util.Locale
import java.util.concurrent.Executors

/** Android Auto – výběr roadbooku (READY nahoře). */
class RoadbookListScreen(carContext: CarContext) : Screen(carContext) {

    private var entries: List<RoadbookRepo.Entry>? = null
    private var online = true
    private var opening = false
    private val worker = Executors.newSingleThreadExecutor()
    private val main = Handler(Looper.getMainLooper())

    init {
        load()
    }

    private fun load() {
        worker.execute {
            val (list, on) = RoadbookRepo(carContext).list()
            main.post {
                entries = list
                online = on
                invalidate()
            }
        }
    }

    private fun listLimit(): Int = try {
        if (carContext.carAppApiLevel >= 2)
            carContext.getCarService(ConstraintManager::class.java).getContentLimit(ConstraintManager.CONTENT_LIMIT_TYPE_LIST)
        else 6
    } catch (e: Exception) {
        6
    }

    override fun onGetTemplate(): Template {
        val builder = ListTemplate.Builder()
            .setTitle(if (online) "CendurOFF Roadbook" else "CendurOFF Roadbook · offline")
            .setHeaderAction(Action.BACK)
        val list = entries ?: return builder.setLoading(true).build()

        val items = ItemList.Builder()
        if (list.isEmpty()) {
            items.setNoItemsMessage(
                if (online) "Zatím tu není žádný roadbook. Připrav ho v Roadbook planneru."
                else "Jsi offline a v telefonu není uložený žádný roadbook."
            )
        }
        for (e in list.take(listLimit())) {
            val km = String.format(Locale("cs", "CZ"), "%.1f km", e.km)
            val status = "(" + e.stateLabel + ")"
            items.addItem(
                Row.Builder()
                    .setTitle(e.name)
                    .addText("$km · $status" + if (e.offline) " · v telefonu" else "")
                    .setOnClickListener { open(e) }
                    .build()
            )
        }
        builder.setSingleList(items.build())
        builder.setActionStrip(
            ActionStrip.Builder()
                .addAction(
                    Action.Builder()
                        .setTitle("Obnovit")
                        .setOnClickListener {
                            entries = null
                            invalidate()
                            load()
                        }
                        .build()
                )
                .build()
        )
        return builder.build()
    }

    private fun open(e: RoadbookRepo.Entry) {
        if (opening) return
        opening = true
        CarToast.makeText(carContext, "Načítám roadbook…", CarToast.LENGTH_SHORT).show()
        worker.execute {
            val rb = RoadbookRepo(carContext).load(e.routeId)
            main.post {
                opening = false
                if (rb == null || rb.items.isEmpty()) {
                    CarToast.makeText(carContext, "Roadbook se nepodařilo načíst.", CarToast.LENGTH_LONG).show()
                } else {
                    screenManager.push(RoadbookNavScreen(carContext, rb))
                }
            }
        }
    }
}
