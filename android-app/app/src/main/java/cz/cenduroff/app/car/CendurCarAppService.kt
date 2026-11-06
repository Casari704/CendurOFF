package cz.cenduroff.app.car

import android.content.Intent
import androidx.car.app.CarAppService
import androidx.car.app.Screen
import androidx.car.app.Session
import androidx.car.app.SessionInfo
import androidx.car.app.validation.HostValidator

/**
 * Vstup pro Android Auto. Aplikace je jen pro interní použití (instaluje se mimo Google Play
 * a v Android Auto se zapínají „Neznámé zdroje“), proto povoluje všechny hostitele.
 */
class CendurCarAppService : CarAppService() {
    override fun createHostValidator(): HostValidator = HostValidator.ALLOW_ALL_HOSTS_VALIDATOR

    // obě varianty (starší i novější Android Auto knihovna)
    @Suppress("OVERRIDE_DEPRECATION", "DEPRECATION")
    override fun onCreateSession(): Session = CendurSession()

    override fun onCreateSession(sessionInfo: SessionInfo): Session = CendurSession()
}

class CendurSession : Session() {
    override fun onCreateScreen(intent: Intent): Screen = HomeScreen(carContext)
}
