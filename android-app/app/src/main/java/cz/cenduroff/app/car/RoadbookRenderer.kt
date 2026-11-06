package cz.cenduroff.app.car

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import androidx.core.graphics.PathParser
import cz.cenduroff.app.roadbook.Icons
import cz.cenduroff.app.roadbook.RbItem
import cz.cenduroff.app.roadbook.Roadbook
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/**
 * Kreslí roadbook na displej Android Auto (varianta 3 – „roadbook přes celou plochu“):
 * nahoře KM / DÍLČÍ / CAP, uprostřed velká aktuální instrukce a vpravo dvě další
 * (bližší dole), dole žlutý pruh „DALŠÍ ZA … m“ s ukazatelem.
 */
class RoadbookRenderer {

    class State(
        val roadbook: Roadbook,
        val odo: Double,
        val hasFix: Boolean,
        val capDeg: Int?,
        val offRouteM: Double?,
        val message: String?,
        val animFrom: Int? = null,      // animace posunu: z které instrukce…
        val animT: Float = 1f           // …a jak daleko (0..1)
    )

    companion object {
        /** Index aktuální (další) instrukce – stejný výpočet pro kreslení i pro spouštění animace. */
        fun currentIndex(items: List<RbItem>, odo: Double, hasFix: Boolean): Int {
            if (items.isEmpty()) return 0
            if (!hasFix) return min(1, items.size - 1)
            val i = items.indexOfFirst { it.s > odo + 8 }
            return if (i < 0) items.size - 1 else i
        }
    }

    /** Kam se mají nakreslit tlačítka (pravá část žlutého pruhu) – vyplní draw(). */
    var buttonBox = RectF()
        private set

    private val ink = Color.parseColor("#111111")
    private val amber = Color.parseColor("#F5B700")
    private val amberSoft = Color.parseColor("#FFF6D6")
    private val red = Color.parseColor("#C8191F")
    private val grey = Color.parseColor("#8F8F8F")

    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }
    private val textReg = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.DEFAULT }
    private val pathCache = HashMap<String, Path>()

    private fun path(d: String): Path = pathCache.getOrPut(d) {
        try { PathParser.createPathFromPathData(d) } catch (e: Exception) { Path() }
    }

    fun draw(canvas: Canvas, area: Rect, st: State) {
        canvas.drawColor(ink)
        val w = area.width().toFloat()
        val h = area.height().toFloat()
        val left = area.left.toFloat()
        val top = area.top.toFloat()
        // měřítko podle výšky (displeje jsou široké a nízké); šířky se počítají z w
        val u = min(h / 480f, w / 640f)

        val items = st.roadbook.items
        val idx = currentIndex(items, st.odo, st.hasFix)
        val cur = items.getOrNull(idx)
        val prev = items.getOrNull(idx - 1)

        // ---- horní pruh: KM, DÍLČÍ, CAP – velká čísla, ať jdou vidět za jízdy ----
        val headH = 78f * u
        val base = top + headH * 0.80f
        var x = left + 14f * u
        x = label(canvas, "KM", Roadbook.fmtKm(st.odo), x, base, 64f * u, u)
        x = label(canvas, "DÍLČÍ", Roadbook.fmtKm(if (prev != null) st.odo - prev.s else st.odo), x + 30f * u, base, 52f * u, u)
        label(canvas, "CAP", st.capDeg?.let { "${it}°" } ?: "—", x + 30f * u, base, 38f * u, u)

        // ---- spodní žlutý pruh: vzdálenost vlevo, ukazatel postupu, vpravo tlačítka ----
        val barH = 88f * u
        val barTop = top + h - barH
        fill.color = amber
        canvas.drawRect(left, barTop, left + w, top + h, fill)
        val dist = if (cur != null) max(0.0, cur.s - st.odo) else 0.0
        text.color = ink
        text.textSize = 15f * u
        canvas.drawText("DALŠÍ ZA", left + 16f * u, barTop + 24f * u, text)
        text.textSize = 58f * u
        val distTxt = if (st.hasFix && cur != null) Roadbook.fmtDist(dist) else "—"
        canvas.drawText(distTxt, left + 16f * u, barTop + 80f * u, text)
        val distRight = left + 16f * u + text.measureText(distTxt) + 24f * u
        // ukazatel postupu k další instrukci – tenký pruh přes horní okraj žlutého pásu
        val pbH = 8f * u
        fill.color = Color.argb(70, 17, 17, 17)
        canvas.drawRect(left, barTop, left + w, barTop + pbH, fill)
        val seg = if (cur != null && prev != null) cur.s - prev.s else 0.0
        val frac = if (seg > 0) (1.0 - dist / seg).coerceIn(0.0, 1.0).toFloat() else 0f
        fill.color = ink
        if (frac > 0f) canvas.drawRect(left, barTop, left + w * frac, barTop + pbH, fill)
        buttonBox = RectF(max(distRight, left + w * 0.40f), barTop + pbH + 10f * u, left + w - 12f * u, top + h - 10f * u)

        // ---- střed: aktuální instrukce + dvě další ----
        val midTop = top + headH
        val midBottom = barTop
        fill.color = Color.WHITE
        canvas.drawRect(left, midTop, left + w, midBottom, fill)
        val rightW = max(250f * u, w * 0.27f)
        val curRect = RectF(left, midTop, left + w - rightW, midBottom)
        val colLeft = left + w - rightW
        val half = (midBottom - midTop) / 2f
        val midH = midBottom - midTop
        // plynulý posun: p = „kolikátá instrukce je aktuální“ i s desetinami během animace;
        // roadbook se roluje dolů (nová instrukce přijíždí shora, projetá odjíždí dolů)
        val from = st.animFrom
        val e = st.animT.coerceIn(0f, 1f).let { it * it * (3f - 2f * it) }
        val p = if (from != null && from != idx) from + (idx - from) * e else idx.toFloat()
        val k0 = floor(p).toInt()
        canvas.save()
        canvas.clipRect(curRect)
        for (k in k0..k0 + 1) {
            val item = items.getOrNull(k) ?: continue
            val dy = midH * (p - k)
            if (abs(dy) >= midH) continue
            drawCurrent(canvas, RectF(curRect.left, curRect.top + dy, curRect.right, curRect.bottom + dy), item, u)
        }
        canvas.restore()
        canvas.save()
        canvas.clipRect(colLeft, midTop, left + w, midBottom)
        for (k in k0 + 1..k0 + 3) {
            val item = items.getOrNull(k) ?: continue
            val y = midTop + half * (p + 2 - k)
            if (y >= midBottom || y + half <= midTop) continue
            val r = RectF(colLeft, y, left + w, y + half)
            drawSmall(canvas, r, item, u)
            stroke.color = ink
            stroke.strokeWidth = 3f * u
            canvas.drawLine(colLeft, y, left + w, y, stroke)
        }
        canvas.restore()
        stroke.color = ink
        stroke.strokeWidth = 4f * u
        canvas.drawLine(colLeft, midTop, colLeft, midBottom, stroke)

        // ---- hlášky ----
        val msg = when {
            st.message != null -> st.message
            st.offRouteM != null -> "MIMO TRASU · " + Roadbook.fmtDist(st.offRouteM)
            !st.hasFix -> "Čekám na GPS…"
            else -> null
        }
        if (msg != null) {
            // velký hranatý pruh dole v aktuální instrukci, zarovnaný k jejímu pravému okraji
            val boxH = 62f * u
            val maxW = curRect.width() * 0.62f
            text.textSize = 38f * u
            var tw = text.measureText(msg)
            if (tw > maxW - 32f * u) { text.textSize *= (maxW - 32f * u) / tw; tw = text.measureText(msg) }
            val bw = max(tw + 32f * u, curRect.width() * 0.45f)
            val bx = curRect.right - bw
            val by = curRect.bottom - boxH
            val isOff = st.offRouteM != null && st.message == null
            fill.color = if (isOff) red else ink
            canvas.drawRect(bx, by, curRect.right, curRect.bottom, fill)
            text.color = if (isOff) Color.WHITE else amber
            canvas.drawText(msg, bx + (bw - tw) / 2f, by + boxH / 2f + text.textSize * 0.36f, text)
        }
    }

    private fun label(c: Canvas, name: String, value: String, x: Float, base: Float, size: Float, u: Float): Float {
        text.color = Color.parseColor("#B5B5B5")
        text.textSize = 16f * u
        c.drawText(name, x, base, text)
        val vx = x + text.measureText(name) + 8f * u
        text.color = Color.WHITE
        text.textSize = size
        c.drawText(value, vx, base, text)
        return vx + text.measureText(value)
    }

    private fun drawCurrent(c: Canvas, r: RectF, item: RbItem, u: Float) {
        fill.color = amberSoft
        c.drawRect(r, fill)
        stroke.color = amber
        stroke.strokeWidth = 6f * u
        c.drawRect(r.left + 3f * u, r.top + 3f * u, r.right - 3f * u, r.bottom - 3f * u, stroke)
        // km sloupec
        val kmTxt = Roadbook.fmtKm(item.s)
        val parTxt = Roadbook.fmtKm(item.par)
        val colW = min(max(150f * u, r.width() * 0.17f), r.width() * 0.34f)
        stroke.color = ink
        stroke.strokeWidth = 3f * u
        c.drawLine(r.left + colW, r.top, r.left + colW, r.bottom, stroke)
        text.color = Color.parseColor("#555555")
        text.textSize = 18f * u
        c.drawText("#${item.n}", r.left + 14f * u, r.top + 30f * u, text)
        text.color = ink
        text.textSize = fit(kmTxt, text, colW - 24f * u, 58f * u)
        c.drawText(kmTxt, r.left + 12f * u, r.centerY() + text.textSize * 0.35f, text)
        val parSize = fit(parTxt, text, colW - 40f * u, 40f * u)
        parBox(c, parTxt, r.left + 12f * u, r.bottom - parSize * 1.3f - 14f * u, parSize, 4f * u, u)

        // zbytek: na širokém displeji tulipán přes celou výšku vlevo a text vedle,
        // na úzkém (např. vysunutý boční panel s hudbou) tulipán nahoře a pod ním jeden řádek textu
        val ax = r.left + colW
        val aw = r.right - ax
        val pad = 10f * u
        val sideBySide = aw > r.height() * 1.5f
        c.save()
        c.clipRect(ax, r.top, r.right, r.bottom)
        if (sideBySide) {
            val tSize = min(r.height() - 2 * pad, aw * 0.5f)
            val tRect = RectF(ax + pad, r.top + (r.height() - tSize) / 2f, ax + pad + tSize, r.top + (r.height() + tSize) / 2f)
            drawTulip(c, item, tRect, 1f)
            val textLeft = tRect.right + 8f * u
            val textW = r.right - textLeft - 14f * u
            var ty = r.top + 26f * u
            val icS = 52f * u
            if (iconRow(c, item, textLeft, ty, textW, icS, u)) ty += icS + 8f * u
            text.color = ink
            text.textSize = 44f * u
            for (ln in wrap(Roadbook.label(item).uppercase(), text, textW, 2)) {
                ty += text.textSize
                c.drawText(ln, textLeft, ty, text)
                ty += 4f * u
            }
            val sub = Roadbook.subLabel(item)
            if (sub.isNotBlank()) {
                textReg.color = Color.parseColor("#333333")
                textReg.textSize = 26f * u
                for (ln in wrap(sub, textReg, textW, 2)) {
                    if (ty + textReg.textSize > r.bottom - 8f * u) break
                    ty += textReg.textSize + 2f * u
                    c.drawText(ln, textLeft, ty, textReg)
                }
            }
        } else {
            val textLeft = ax + 10f * u
            val textW = aw - 20f * u
            val icS = 36f * u
            val hasIcons = item.danger in 1..3 || item.icons.isNotEmpty()
            val lab = Roadbook.label(item).uppercase()
            text.textSize = 40f * u
            val labSize = max(24f * u, fit(lab, text, textW, 40f * u))
            val sub = Roadbook.subLabel(item)
            val subSize = 20f * u
            val textBlock = (if (hasIcons) icS + 6f * u else 0f) + labSize + 6f * u
            val withSub = sub.isNotBlank() && r.height() - textBlock - subSize - 8f * u > r.height() * 0.45f
            val block = textBlock + (if (withSub) subSize + 6f * u else 0f)
            val tSize = max(40f * u, min(aw - 2 * pad, r.height() - pad - block - 8f * u))
            drawTulip(c, item, RectF(ax + (aw - tSize) / 2f, r.top + pad, ax + (aw + tSize) / 2f, r.top + pad + tSize), 1f)
            var ty = r.top + pad + tSize + 4f * u
            if (hasIcons && iconRow(c, item, textLeft, ty, textW, icS, u)) ty += icS + 6f * u
            text.color = ink
            text.textSize = labSize
            ty += labSize
            c.drawText(ellipsize(lab, text, textW), textLeft, ty, text)
            if (withSub) {
                textReg.color = Color.parseColor("#333333")
                textReg.textSize = subSize
                c.drawText(ellipsize(sub, textReg, textW), textLeft, ty + subSize + 4f * u, textReg)
            }
        }
        c.restore()
    }

    /** Výstraha „!!!“ a ikony v jedné řadě; vrací true, pokud něco nakreslil. */
    private fun iconRow(c: Canvas, item: RbItem, x0: Float, top: Float, maxW: Float, icS: Float, u: Float): Boolean {
        var lx = x0
        var used = false
        if (item.danger in 1..3) {
            val mark = Roadbook.DANGER[item.danger]
            text.textSize = icS * 0.62f
            val bw = text.measureText(mark) + icS * 0.38f
            fill.color = red
            c.drawRoundRect(RectF(lx, top, lx + bw, top + icS), 6f * u, 6f * u, fill)
            text.color = Color.WHITE
            c.drawText(mark, lx + icS * 0.19f, top + icS * 0.5f + text.textSize * 0.36f, text)
            lx += bw + 10f * u
            used = true
        }
        for (k in item.icons) {
            if (lx + icS > x0 + maxW) break
            drawIcon(c, k, RectF(lx, top, lx + icS, top + icS), icS * 0.05f)
            lx += icS + 10f * u
            used = true
        }
        return used
    }

    private fun drawSmall(c: Canvas, r: RectF, item: RbItem?, u: Float) {
        if (item == null) return
        c.save()
        c.clipRect(r)
        drawSmallInner(c, r, item, u)
        c.restore()
    }

    private fun drawSmallInner(c: Canvas, r: RectF, item: RbItem, u: Float) {
        val kmTxt = Roadbook.fmtKm(item.s)
        val parTxt = Roadbook.fmtKm(item.par)
        val colW = max(104f * u, r.width() * 0.36f)
        stroke.color = ink
        stroke.strokeWidth = 3f * u
        c.drawLine(r.left + colW, r.top, r.left + colW, r.bottom, stroke)
        text.color = ink
        text.textSize = fit(kmTxt, text, colW - 18f * u, 34f * u)
        c.drawText(kmTxt, r.left + 9f * u, r.centerY() - 6f * u, text)
        val parSize = fit(parTxt, text, colW - 32f * u, 24f * u)
        parBox(c, parTxt, r.left + 9f * u, r.centerY() + 6f * u, parSize, 3f * u, u)
        text.textSize = 18f * u
        val labH = 24f * u
        val tSize = min(r.height() - labH - 10f * u, r.width() - colW - 12f * u)
        val cx = r.left + colW + (r.width() - colW) / 2f
        drawTulip(c, item, RectF(cx - tSize / 2f, r.top + 5f * u, cx + tSize / 2f, r.top + 5f * u + tSize), 1f)
        val lab = ellipsize(Roadbook.label(item).uppercase(), text, r.width() - colW - 10f * u)
        c.drawText(lab, cx - text.measureText(lab) / 2f, r.bottom - 8f * u, text)
    }

    /** Velikost písma, aby se text vešel do šířky (nejvýš max). */
    private fun fit(s: String, p: Paint, maxW: Float, maxSize: Float): Float {
        p.textSize = maxSize
        val tw = p.measureText(s)
        val size = if (tw > maxW && tw > 0f) maxSize * maxW / tw else maxSize
        p.textSize = size
        return size
    }

    /** Zalomí text po slovech do nejvýš maxLines řádků; poslední případně zkrátí „…“. */
    private fun wrap(s: String, p: Paint, maxW: Float, maxLines: Int): List<String> {
        val words = s.trim().split(Regex("\\s+")).filter { it.isNotEmpty() }
        val out = ArrayList<String>()
        var line = ""
        var i = 0
        while (i < words.size) {
            val cand = if (line.isEmpty()) words[i] else line + " " + words[i]
            if (p.measureText(cand) <= maxW || line.isEmpty()) {
                line = cand; i++
            } else {
                out.add(line); line = ""
                if (out.size == maxLines - 1) break
            }
        }
        if (out.size < maxLines) {
            val rest = (listOf(line) + words.drop(i)).filter { it.isNotEmpty() }.joinToString(" ")
            if (rest.isNotEmpty()) out.add(ellipsize(rest, p, maxW))
        }
        return out.map { ellipsize(it, p, maxW) }
    }

    private fun parBox(c: Canvas, value: String, x: Float, y: Float, size: Float, border: Float, u: Float) {
        text.color = ink
        text.textSize = size
        val tw = text.measureText(value)
        stroke.color = ink
        stroke.strokeWidth = border
        c.drawRoundRect(RectF(x, y, x + tw + 14f * u, y + size * 1.3f), 5f * u, 5f * u, stroke)
        c.drawText(value, x + 7f * u, y + size * 1.02f, text)
    }

    /** Tulipán (nebo symbol startu / cíle) do čtverce r. */
    fun drawTulip(c: Canvas, item: RbItem, r: RectF, strokeScale: Float) {
        val m = Matrix()
        m.setRectToRect(RectF(0f, 0f, 100f, 100f), r, Matrix.ScaleToFit.CENTER)
        c.save()
        c.concat(m)
        when (item.kind) {
            "start" -> {
                stroke.color = ink; stroke.strokeWidth = 7f
                c.drawCircle(50f, 56f, 18f, stroke)
                fill.color = ink
                c.drawCircle(50f, 56f, 6f, fill)
            }
            "finish" -> {
                stroke.color = ink; stroke.strokeWidth = 6f
                c.drawPath(path("M28 82V22M28 24h44v26H28"), stroke)
                fill.color = ink
                c.drawPath(path("M28 24h11v13H28zM50 24h11v13H50zM39 37h11v13H39zM61 37h11v13H61z"), fill)
            }
            else -> {
                val t = Icons.tulip(item.exit, item.sides, item.round)
                if (t.side.isNotBlank()) {
                    stroke.color = grey; stroke.strokeWidth = 7f * strokeScale
                    c.drawPath(path(t.side), stroke)
                }
                stroke.color = ink; stroke.strokeWidth = 8f * strokeScale
                c.drawPath(path(t.main), stroke)
                fill.color = ink
                c.drawPath(path(t.head), fill)
                stroke.strokeWidth = 3f
                c.drawPath(path(t.head), stroke)
                c.drawCircle(50f, 90f, 7f, fill)
            }
        }
        c.restore()
    }

    private fun drawIcon(c: Canvas, key: String, r: RectF, width: Float) {
        val d = Icons.PATHS[key] ?: return
        val m = Matrix()
        m.setRectToRect(RectF(0f, 0f, 24f, 24f), r, Matrix.ScaleToFit.CENTER)
        val p = Path(path(d))
        p.transform(m)
        stroke.color = if (key == "brod") Color.parseColor("#1E5AA8") else ink
        stroke.strokeWidth = width
        c.drawPath(p, stroke)
    }

    private fun ellipsize(s: String, p: Paint, maxW: Float): String {
        if (maxW <= 0f) return ""
        if (p.measureText(s) <= maxW) return s
        var t = s
        while (t.isNotEmpty() && p.measureText("$t…") > maxW) t = t.dropLast(1)
        return "$t…"
    }
}
