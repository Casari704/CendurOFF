package cz.cenduroff.app.car

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface

/**
 * Tlačítka kreslená přímo do obrazu – svítí pořád (lišta Android Auto se po chvíli schová).
 * Klepnutí se vyhodnocuje přes SurfaceHub.onTap → hit().
 */
class ButtonBar {

    class Btn(val label: String, val action: () -> Unit)

    private val rects = ArrayList<Pair<RectF, Btn>>()
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val border = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }

    /**
     * Nakreslí tlačítka do jedné řady v obdélníku box (zarovnané doprava, nebo doleva).
     * Šířka tlačítka podle textu, výška = výška boxu.
     */
    fun draw(c: Canvas, box: RectF, btns: List<Btn>, u: Float, alignRight: Boolean = true) {
        rects.clear()
        val h = box.height()
        val gap = 10f * u
        text.textSize = h * 0.42f
        val widths = btns.map { maxOf(h * 1.25f, text.measureText(it.label) + h * 0.7f) }
        var total = widths.sum() + gap * (btns.size - 1)
        var scale = 1f
        if (total > box.width()) { scale = box.width() / total; total = box.width() }
        var x = if (alignRight) box.right - total else box.left
        for ((i, b) in btns.withIndex()) {
            val w = widths[i] * scale
            val r = RectF(x, box.top, x + w, box.bottom)
            fill.color = Color.parseColor("#1C1C1C")
            c.drawRoundRect(r, 10f * u, 10f * u, fill)
            border.color = Color.parseColor("#F5B700")
            border.strokeWidth = 3f * u
            c.drawRoundRect(r, 10f * u, 10f * u, border)
            text.color = Color.WHITE
            text.textSize = h * 0.42f * scale.coerceAtLeast(0.75f)
            c.drawText(b.label, r.centerX() - text.measureText(b.label) / 2f, r.centerY() + text.textSize * 0.36f, text)
            rects.add(r to b)
            x += w + gap * scale
        }
    }

    companion object {
        /**
         * Místo pro tlačítka v horním pruhu (nad viditelnou plochou, vedle lišty Android Auto vpravo).
         * Vrací null, když tam pruh není – pak se tlačítka nakreslí jinam.
         */
        fun topBand(full: Rect, area: Rect, u: Float): RectF? {
            val band = (area.top - full.top).toFloat()
            if (band < 40f) return null
            val pad = band * 0.13f
            // vpravo nechat místo pro jedno tlačítko lišty Android Auto
            return RectF(full.left + 14f * u, full.top + pad, full.right - band * 1.6f, area.top - pad)
        }
    }

    /** Klepnutí: spustí tlačítko pod prstem a vrátí true. */
    fun hit(x: Float, y: Float): Boolean {
        for ((r, b) in rects) {
            if (r.contains(x, y)) { b.action(); return true }
        }
        return false
    }
}
