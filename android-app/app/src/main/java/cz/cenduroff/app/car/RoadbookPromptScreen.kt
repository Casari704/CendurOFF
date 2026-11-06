package cz.cenduroff.app.car

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.CarColor
import androidx.car.app.model.MessageTemplate
import androidx.car.app.model.Template

/** Dotaz po přiblížení k trase: „Navigovat podle roadbooku?“ – Navigovat / Ne. */
class RoadbookPromptScreen(
    carContext: CarContext,
    private val routeName: String,
    private val state: String,
    private val onAnswer: (Boolean) -> Unit
) : Screen(carContext) {

    private var answered = false

    private fun answer(yes: Boolean) {
        if (answered) return
        answered = true
        screenManager.pop()
        onAnswer(yes)
    }

    override fun onGetTemplate(): Template {
        val yes = Action.Builder()
            .setTitle("Navigovat")
            .setBackgroundColor(CarColor.GREEN)
            .setOnClickListener { answer(true) }
            .build()
        val no = Action.Builder()
            .setTitle("Ne")
            .setOnClickListener { answer(false) }
            .build()
        val note = when (state) {
            "check" -> " Roadbook je To check – trasa se změnila nebo čeká na kontrolu."
            "draft" -> " Roadbook je zatím rozpracovaný."
            else -> ""
        }
        val msg = "Jsi u trasy „$routeName“.$note\nChceš navigovat podle roadbooku?"
        return MessageTemplate.Builder(msg)
            .setTitle("Roadbook")
            .setHeaderAction(Action.BACK)
            .addAction(yes)
            .addAction(no)
            .build()
    }

    // zpět tlačítkem Android Auto = „Ne“
    init {
        lifecycle.addObserver(object : androidx.lifecycle.DefaultLifecycleObserver {
            override fun onDestroy(owner: androidx.lifecycle.LifecycleOwner) {
                if (!answered) { answered = true; onAnswer(false) }
            }
        })
    }
}
