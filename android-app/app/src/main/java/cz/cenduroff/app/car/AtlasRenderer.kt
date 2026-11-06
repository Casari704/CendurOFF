package cz.cenduroff.app.car

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import cz.cenduroff.app.roadbook.AtlasRoute
import cz.cenduroff.app.roadbook.RbItem
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sqrt

/**
 * Atlas v Android Auto: základní mapa OSM, trasy tučně, poloha dole uprostřed,
 * mapa natočená ve směru jízdy a mírně nakloněná (vidět víc dopředu).
 */
class AtlasRenderer(private val tiles: TileCache) {

    class Corner(val item: RbItem?, val dist: String, val label: String, val note: String?)

    class State(
        val meLat: Double,
        val meLon: Double,
        val heading: Float,
        val zoom: Int,
        val routes: List<AtlasRoute>,
        val activeId: Int?,
        val title: String,
        val subtitle: String?,
        val corner: Corner?,
        val message: String?,
        val loading: String? = null,    // velké okno „Načítám…“ uprostřed
        val flat: Boolean = false,      // výběr trasy: mapa rovně, sever nahoře, já uprostřed
        val routeColor: ((AtlasRoute) -> Int)? = null,  // vlastní barvy tras (např. podle stavu roadbooku)
        val routeBold: ((AtlasRoute) -> Boolean)? = null // tlustší čára (např. trasy s roadbookem)
    )

    /** Kam se mají nakreslit tlačítka (dole vlevo) – vyplní draw(). */
    var buttonBox = RectF()
        private set

    private val ink = Color.parseColor("#111111")
    private val amber = Color.parseColor("#F5B700")
    private val amberSoft = Color.parseColor("#FFF6D6")
    private val activeColor = Color.parseColor("#1E64D6")
    private val typeColors = mapOf(
        "transport" to Color.parseColor("#1E9A45"),
        "cenduro" to Color.parseColor("#E9851C"),
        "offroad" to Color.parseColor("#E0241B")
    )

    private val tilePaint = Paint(Paint.FILTER_BITMAP_FLAG)
    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val line = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private val text = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }
    private val textReg = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.DEFAULT }
    private val rbRenderer = RoadbookRenderer()

    // poslední transformace – kvůli klepnutí na trasu
    private var lastInverse: Matrix? = null
    private var lastScale = 1.0
    private var lastMeMx = 0.0
    private var lastMeMy = 0.0
    private var lastK = 1f

    companion object {
        const val TILT = 0.20f          // jak moc se horní okraj zúží (náklon mapy)
        const val ANCHOR = 0.72f        // poloha šipky odshora (0..1)
    }

    fun draw(canvas: Canvas, area: Rect, st: State, buttonsAtBottom: Boolean = true) {
        val w = area.width().toFloat()
        val h = area.height().toFloat()
        val l = area.left.toFloat()
        val t = area.top.toFloat()
        val u = min(h / 480f, w / 640f)
        val k = (h / 380f).coerceIn(1f, 2.2f)        // zvětšení dlaždic (čitelnost na displeji)
        canvas.save()
        canvas.clipRect(area)
        canvas.drawColor(Color.parseColor("#EAE6DE"))

        val n = 2.0.pow(st.zoom)
        val ts = 256f * k                                // velikost dlaždice v px
        val scale = n * ts                               // px na jednotku Mercatoru
        val meMx = cz.cenduroff.app.roadbook.Merc.x(st.meLon)
        val meMy = cz.cenduroff.app.roadbook.Merc.y(st.meLat)
        val ax = l + w / 2f
        val ay = t + h * (if (st.flat) 0.5f else ANCHOR)

        // svět (relativně ke mně, v px) → obrazovka: otočení podle směru, posun ke šipce, náklon
        val m = Matrix()
        m.setRotate(if (st.flat) 0f else -st.heading)
        m.postTranslate(ax, ay)
        val tilt = Matrix()
        val inset = if (st.flat) 0f else w * TILT
        tilt.setPolyToPoly(
            floatArrayOf(l, t, l + w, t, l + w, t + h, l, t + h), 0,
            floatArrayOf(l + inset, t, l + w - inset, t, l + w, t + h, l, t + h), 0, 4
        )
        m.postConcat(tilt)
        val inv = Matrix()
        val okInv = m.invert(inv)
        lastInverse = if (okInv) inv else null
        lastScale = scale; lastMeMx = meMx; lastMeMy = meMy; lastK = k

        // viditelná část světa (rohy obrazovky zpět do světa), omezená, ať se nestahuje půl republiky
        val lim = max(w, h) * 2.2f
        var minX = -lim; var maxX = lim; var minY = -lim; var maxY = lim
        if (okInv) {
            val pts = floatArrayOf(l, t, l + w, t, l + w, t + h, l, t + h)
            inv.mapPoints(pts)
            minX = Float.MAX_VALUE; maxX = -Float.MAX_VALUE; minY = Float.MAX_VALUE; maxY = -Float.MAX_VALUE
            for (i in 0 until 4) {
                val x = pts[i * 2].coerceIn(-lim, lim)
                val y = pts[i * 2 + 1].coerceIn(-lim, lim)
                minX = min(minX, x); maxX = max(maxX, x); minY = min(minY, y); maxY = max(maxY, y)
            }
        }

        canvas.save()
        canvas.concat(m)
        // ---- dlaždice ----
        val tcx = meMx * n
        val tcy = meMy * n
        val i0 = floor(tcx + minX / ts).toInt()
        val i1 = floor(tcx + maxX / ts).toInt()
        val j0 = floor(tcy + minY / ts).toInt().coerceAtLeast(0)
        val j1 = floor(tcy + maxY / ts).toInt().coerceAtMost(n.toInt() - 1)
        val maxI = n.toInt()
        val dst = RectF()
        val src = Rect()
        for (j in j0..j1) for (i in i0..i1) {
            val ii = ((i % maxI) + maxI) % maxI
            val x = ((i - tcx) * ts).toFloat()
            val y = ((j - tcy) * ts).toFloat()
            dst.set(x, y, x + ts + 0.6f, y + ts + 0.6f)    // +0,6 px proti spárám
            val bmp: Bitmap? = tiles.get(st.zoom, ii, j)
            if (bmp != null) {
                canvas.drawBitmap(bmp, null, dst, tilePaint)
            } else if (st.zoom > 1) {
                // než se stáhne, ukáže se zvětšená dlaždice z menšího přiblížení (je-li v paměti)
                val parent = tiles.peek(st.zoom - 1, ii / 2, j / 2)
                if (parent != null) {
                    val half = parent.width / 2
                    val sx = (ii % 2) * half
                    val sy = (j % 2) * half
                    src.set(sx, sy, sx + half, sy + half)
                    canvas.drawBitmap(parent, src, dst, tilePaint)
                }
            }
        }

        // ---- trasy ----
        val vMinMx = meMx + minX / scale; val vMaxMx = meMx + maxX / scale
        val vMinMy = meMy + minY / scale; val vMaxMy = meMy + maxY / scale
        var active: AtlasRoute? = null
        val path = Path()
        for (r in st.routes) {
            if (r.id == st.activeId) { active = r; continue }
            if (r.maxMx < vMinMx || r.minMx > vMaxMx || r.maxMy < vMinMy || r.minMy > vMaxMy) continue
            buildPath(path, r, meMx, meMy, scale, 1.5f)
            val bold = st.routeBold?.invoke(r) ?: false
            line.color = Color.WHITE; line.strokeWidth = (if (bold) 15f else 11f) * k
            canvas.drawPath(path, line)
            line.color = st.routeColor?.invoke(r) ?: typeColors[r.type] ?: typeColors["offroad"]!!
            line.strokeWidth = (if (bold) 10f else 7f) * k
            canvas.drawPath(path, line)
        }
        active?.let { r ->
            buildPath(path, r, meMx, meMy, scale, 1.2f)
            line.color = Color.WHITE; line.strokeWidth = 17f * k
            canvas.drawPath(path, line)
            line.color = activeColor; line.strokeWidth = 12f * k
            canvas.drawPath(path, line)
        }
        canvas.restore()

        // ---- moje poloha: šipka (mapa je natočená, takže šipka míří vždy nahoru) ----
        val me = floatArrayOf(ax, ay)
        tilt.mapPoints(me)
        if (st.flat) {
            // sever nahoře – poloha jako tečka (směr jízdy tu nemá smysl)
            fill.color = Color.WHITE
            canvas.drawCircle(me[0], me[1], 15f * k, fill)
            fill.color = Color.parseColor("#E8742A")
            canvas.drawCircle(me[0], me[1], 11f * k, fill)
        } else {
            drawMe(canvas, me[0], me[1], 26f * k)
        }

        // ---- horní pruh: Volná jízda / Trasa: … ----
        drawTitle(canvas, l, t, w, st, u)
        // ---- roh s roadbookem ----
        st.corner?.let { drawCorner(canvas, l + w, t, it, u) }
        // ---- tlačítka dole (kreslí AtlasScreen) ----
        val btnH = 64f * u
        buttonBox = if (buttonsAtBottom) RectF(l + 12f * u, t + h - 12f * u - btnH, l + w - 12f * u, t + h - 12f * u)
                    else RectF(l, t + h, l + w, t + h)   // tlačítka jsou nahoře mimo mapu
        // ---- hláška (GPS apod.) – nad tlačítky ----
        st.message?.let {
            text.textSize = 24f * u
            val tw = text.measureText(it) + 28f * u
            val bx = l + (w - tw) / 2f
            val by = buttonBox.top - 54f * u
            fill.color = ink
            canvas.drawRoundRect(RectF(bx, by, bx + tw, by + 42f * u), 12f * u, 12f * u, fill)
            text.color = amber
            canvas.drawText(it, bx + 14f * u, by + 30f * u, text)
        }
        // OSM chce být uvedené
        textReg.textSize = 11f * u
        textReg.color = Color.parseColor("#555555")
        canvas.drawText("© OpenStreetMap", l + w - textReg.measureText("© OpenStreetMap") - 6f * u, buttonBox.top - 6f * u, textReg)
        // ---- načítání: velké okno uprostřed, ať je jasné, že aplikace nezamrzla ----
        st.loading?.let {
            val bw = min(w * 0.7f, 520f * u)
            val bh = 120f * u
            val bx = l + (w - bw) / 2f
            val by = t + (h - bh) / 2f
            fill.color = Color.argb(235, 17, 17, 17)
            c2(canvas, RectF(bx, by, bx + bw, by + bh), u)
            text.color = amber
            text.textSize = 34f * u
            canvas.drawText("Načítám…", bx + 24f * u, by + 50f * u, text)
            textReg.color = Color.WHITE
            textReg.textSize = 22f * u
            canvas.drawText(ellipsize(it, textReg, bw - 48f * u), bx + 24f * u, by + 92f * u, textReg)
        }
        canvas.restore()
    }

    private fun c2(c: Canvas, r: RectF, u: Float) {
        c.drawRoundRect(r, 14f * u, 14f * u, fill)
        line.color = amber; line.strokeWidth = 4f * u
        c.drawRoundRect(r, 14f * u, 14f * u, line)
    }

    private fun buildPath(p: Path, r: AtlasRoute, meMx: Double, meMy: Double, scale: Double, minStep: Float) {
        p.rewind()
        var lx = 0f; var ly = 0f
        for (i in r.mx.indices) {
            val x = ((r.mx[i] - meMx) * scale).toFloat()
            val y = ((r.my[i] - meMy) * scale).toFloat()
            if (i == 0) { p.moveTo(x, y); lx = x; ly = y; continue }
            val dx = x - lx; val dy = y - ly
            if (dx * dx + dy * dy < minStep * minStep && i != r.mx.size - 1) continue
            p.lineTo(x, y); lx = x; ly = y
        }
    }

    private fun drawMe(c: Canvas, x: Float, y: Float, s: Float) {
        val p = Path()
        p.moveTo(x, y - s)
        p.lineTo(x + s * 0.72f, y + s * 0.78f)
        p.lineTo(x, y + s * 0.38f)
        p.lineTo(x - s * 0.72f, y + s * 0.78f)
        p.close()
        fill.color = Color.parseColor("#E8742A")
        c.drawPath(p, fill)
        line.color = Color.WHITE; line.strokeWidth = s * 0.16f
        c.drawPath(p, line)
    }

    private fun drawTitle(c: Canvas, l: Float, t: Float, w: Float, st: State, u: Float) {
        val pad = 12f * u
        text.textSize = 30f * u
        val tw = text.measureText(st.title)
        textReg.textSize = 18f * u
        val sw = st.subtitle?.let { textReg.measureText(it) } ?: 0f
        val bw = min(max(tw, sw) + pad * 2, w * 0.62f)
        val bh = if (st.subtitle != null) 70f * u else 48f * u
        fill.color = if (st.activeId != null && st.subtitle == null) activeColor else ink
        c.drawRoundRect(RectF(l + pad, t + pad, l + pad + bw, t + pad + bh), 12f * u, 12f * u, fill)
        text.color = Color.WHITE
        c.drawText(ellipsize(st.title, text, bw - pad * 2), l + pad * 2, t + pad + 36f * u, text)
        st.subtitle?.let {
            textReg.color = amber
            c.drawText(ellipsize(it, textReg, bw - pad * 2), l + pad * 2, t + pad + 60f * u, textReg)
        }
    }

    private fun drawCorner(c: Canvas, right: Float, t: Float, cn: Corner, u: Float) {
        val pad = 12f * u
        val bw = 190f * u
        val x0 = right - pad - bw
        val y0 = t + pad
        if (cn.item == null) {
            // jen poznámka (např. jedeš proti směru roadbooku)
            text.textSize = 18f * u
            val lines = cn.note ?: return
            val bh = 46f * u
            fill.color = ink
            c.drawRoundRect(RectF(x0, y0, x0 + bw, y0 + bh), 12f * u, 12f * u, fill)
            text.color = amber
            c.drawText(ellipsize(lines, text, bw - 20f * u), x0 + 10f * u, y0 + 30f * u, text)
            return
        }
        val bh = 232f * u
        val r = RectF(x0, y0, x0 + bw, y0 + bh)
        fill.color = amberSoft
        c.drawRoundRect(r, 12f * u, 12f * u, fill)
        line.color = amber; line.strokeWidth = 5f * u
        c.drawRoundRect(r, 12f * u, 12f * u, line)
        val ts = 128f * u
        rbRenderer.drawTulip(c, cn.item, RectF(x0 + (bw - ts) / 2f, y0 + 8f * u, x0 + (bw + ts) / 2f, y0 + 8f * u + ts), 1f)
        text.color = ink
        text.textSize = fitSize(cn.dist, text, bw - 20f * u, 44f * u)
        c.drawText(cn.dist, x0 + (bw - text.measureText(cn.dist)) / 2f, y0 + ts + 52f * u, text)
        text.textSize = 18f * u
        val lab = ellipsize(cn.label, text, bw - 16f * u)
        c.drawText(lab, x0 + (bw - text.measureText(lab)) / 2f, y0 + ts + 84f * u, text)
    }

    /** Klepnutí na mapu → nejbližší trasa pod prstem (nebo null). */
    fun hitTest(x: Float, y: Float, routes: List<AtlasRoute>): AtlasRoute? {
        val inv = lastInverse ?: return null
        val p = floatArrayOf(x, y)
        inv.mapPoints(p)
        val tol = 34f * lastK
        var best: AtlasRoute? = null
        var bestD = tol.toDouble()
        for (r in routes) {
            val px = lastMeMx + p[0] / lastScale
            val py = lastMeMy + p[1] / lastScale
            val tm = tol / lastScale
            if (px < r.minMx - tm || px > r.maxMx + tm || py < r.minMy - tm || py > r.maxMy + tm) continue
            for (i in 0 until r.mx.size - 1) {
                val ax = ((r.mx[i] - lastMeMx) * lastScale) - p[0]
                val ay = ((r.my[i] - lastMeMy) * lastScale) - p[1]
                val bx = ((r.mx[i + 1] - lastMeMx) * lastScale) - p[0]
                val by = ((r.my[i + 1] - lastMeMy) * lastScale) - p[1]
                val dx = bx - ax; val dy = by - ay
                val len = dx * dx + dy * dy
                val tt = (if (len > 0) -(ax * dx + ay * dy) / len else 0.0).coerceIn(0.0, 1.0)
                val qx = ax + tt * dx; val qy = ay + tt * dy
                val d = sqrt(qx * qx + qy * qy)
                if (d < bestD) { bestD = d; best = r }
            }
        }
        return best
    }

    private fun fitSize(s: String, p: Paint, maxW: Float, maxSize: Float): Float {
        p.textSize = maxSize
        val tw = p.measureText(s)
        return if (tw > maxW && tw > 0f) maxSize * maxW / tw else maxSize
    }

    private fun ellipsize(s: String, p: Paint, maxW: Float): String {
        if (maxW <= 0f) return ""
        if (p.measureText(s) <= maxW) return s
        var x = s
        while (x.isNotEmpty() && p.measureText("$x…") > maxW) x = x.dropLast(1)
        return "$x…"
    }
}
