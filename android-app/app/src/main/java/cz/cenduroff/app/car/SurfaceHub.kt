package cz.cenduroff.app.car

import android.graphics.Canvas
import android.graphics.Rect
import androidx.car.app.AppManager
import androidx.car.app.CarContext
import androidx.car.app.SurfaceCallback
import androidx.car.app.SurfaceContainer

/**
 * Jeden společný povrch pro všechny obrazovky, které kreslí samy (úvod, roadbook, Atlas).
 * Android Auto má jeden povrch na aplikaci – obrazovky se jen střídají v tom, kdo na něj kreslí.
 */
object SurfaceHub : SurfaceCallback {

    interface Target {
        fun redraw()
        fun onTap(x: Float, y: Float) {}
        fun onPinch(scaleFactor: Float) {}
    }

    private var container: SurfaceContainer? = null
    private var visible: Rect? = null
    private var target: Target? = null

    /** Obrazovka se ujme kreslení (volat v onStart). */
    fun attach(carContext: CarContext, t: Target) {
        target = t
        try { carContext.getCarService(AppManager::class.java).setSurfaceCallback(this) } catch (e: Exception) {}
        t.redraw()
    }

    /** Obrazovka končí (volat v onDestroy) – pustí kreslení, jen pokud ho ještě má ona. */
    fun detach(t: Target) {
        if (target === t) target = null
    }

    /**
     * Nakreslí na povrch – ale jen obrazovka, která je právě nahoře (target). Ostatní (např. Atlas,
     * kterému se po odchodu ještě dotahují dlaždice) už kreslit nesmí, jinak by „přeskočily“ přes úvod.
     */
    fun draw(owner: Target, block: (Canvas, Rect) -> Unit): Boolean = drawFull(owner) { c, area, _ -> block(c, area) }

    /** Jako draw(), ale dostane i celý povrch (včetně pruhu nahoře, kde je lišta Android Auto). */
    fun drawFull(owner: Target, block: (Canvas, Rect, Rect) -> Unit): Boolean {
        if (target !== owner) return false
        val c = container ?: return false
        val s = c.surface ?: return false
        if (!s.isValid) return false
        val full = Rect(0, 0, c.width, c.height)
        val area = visible?.takeIf { it.width() > 0 && it.height() > 0 } ?: full
        val canvas = try { s.lockCanvas(null) } catch (e: Exception) { return false } ?: return false
        try {
            block(canvas, area, full)
        } finally {
            s.unlockCanvasAndPost(canvas)
        }
        return true
    }

    override fun onSurfaceAvailable(surfaceContainer: SurfaceContainer) {
        container = surfaceContainer
        target?.redraw()
    }

    override fun onSurfaceDestroyed(surfaceContainer: SurfaceContainer) {
        container = null
    }

    override fun onVisibleAreaChanged(visibleArea: Rect) {
        visible = visibleArea
        target?.redraw()
    }

    override fun onStableAreaChanged(stableArea: Rect) {
        if (visible == null) visible = stableArea
        target?.redraw()
    }

    override fun onClick(x: Float, y: Float) {
        target?.onTap(x, y)
    }

    override fun onScale(focusX: Float, focusY: Float, scaleFactor: Float) {
        target?.onPinch(scaleFactor)
    }
}
