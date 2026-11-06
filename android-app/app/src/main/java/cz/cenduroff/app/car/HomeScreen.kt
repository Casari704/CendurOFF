package cz.cenduroff.app.car

import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.Action
import androidx.car.app.model.ActionStrip
import androidx.car.app.model.CarIcon
import androidx.car.app.model.Template
import androidx.car.app.navigation.model.NavigationTemplate
import androidx.core.graphics.PathParser
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import cz.cenduroff.app.R
import kotlin.math.min

/**
 * Úvod v Android Auto: dvě velké barevné dlaždice (kreslíme je sami, ať jsou opravdu velké).
 * Klepnutí do dlaždice otevře modul; pro displeje bez klepání do kresby jsou stejné volby
 * i nahoře v liště (Roadbook / ikona Atlasu).
 */
class HomeScreen(carContext: CarContext) : Screen(carContext), SurfaceHub.Target {

    private var rbRect = RectF()
    private var atRect = RectF()

    private val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val stroke = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeCap = Paint.Cap.ROUND; strokeJoin = Paint.Join.ROUND
    }
    private val title = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }
    private val sub = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD) }

    init {
        lifecycle.addObserver(object : DefaultLifecycleObserver {
            // při každém návratu na úvod si povrch převezmeme zpět (podobrazovky ho při odchodu pustí)
            override fun onStart(owner: LifecycleOwner) {
                SurfaceHub.attach(carContext, this@HomeScreen)
            }

            override fun onDestroy(owner: LifecycleOwner) {
                SurfaceHub.detach(this@HomeScreen)
            }
        })
    }

    private fun openRoadbook() = screenManager.push(RoadbookPickScreen(carContext))
    private fun openAtlas() = screenManager.push(AtlasScreen(carContext))

    override fun onGetTemplate(): Template {
        val rb = Action.Builder()
            .setTitle("Roadbook")
            .setOnClickListener { openRoadbook() }
            .build()
        val at = Action.Builder()
            .setIcon(CarIcon.Builder(IconCompat.createWithResource(carContext, R.drawable.tile_atlas)).build())
            .setOnClickListener { openAtlas() }
            .build()
        return NavigationTemplate.Builder()
            .setActionStrip(ActionStrip.Builder().addAction(rb).addAction(at).build())
            .build()
    }

    override fun onTap(x: Float, y: Float) {
        when {
            rbRect.contains(x, y) -> openRoadbook()
            atRect.contains(x, y) -> openAtlas()
        }
    }

    override fun redraw() {
        SurfaceHub.draw(this) { c, area -> draw(c, area) }
    }

    private fun draw(c: Canvas, area: Rect) {
        c.drawColor(Color.parseColor("#151515"))
        val w = area.width().toFloat()
        val h = area.height().toFloat()
        val u = min(h / 400f, w / 700f)
        val gap = 18f * u
        val pad = 18f * u
        val tw = (w - pad * 2 - gap) / 2f
        val th = h - pad * 2
        val l = area.left + pad
        val t = area.top + pad
        rbRect = RectF(l, t, l + tw, t + th)
        atRect = RectF(l + tw + gap, t, l + tw * 2 + gap, t + th)
        tile(c, rbRect, Color.parseColor("#F5B700"), Color.parseColor("#111111"), "Navigace ROADBOOK", "jízda podle instrukcí", true, u)
        tile(c, atRect, Color.parseColor("#4F7048"), Color.WHITE, "Navigace ATLAS", "mapa a poloha vůči trasám", false, u)
    }

    private fun tile(c: Canvas, r: RectF, bg: Int, fg: Int, t1: String, t2: String, roadbook: Boolean, u: Float) {
        fill.color = bg
        c.drawRoundRect(r, 22f * u, 22f * u, fill)
        // velká ikona v horní části
        val icon = min(r.width() * 0.42f, r.height() * 0.46f)
        val ir = RectF(r.centerX() - icon / 2f, r.top + r.height() * 0.12f, r.centerX() + icon / 2f, r.top + r.height() * 0.12f + icon)
        if (roadbook) iconRoadbook(c, ir, fg) else iconAtlas(c, ir)
        // texty – zmenší se, aby se vešly na šířku
        title.color = fg
        fitText(title, t1, r.width() - 28f * u, 34f * u)
        c.drawText(t1, r.centerX() - title.measureText(t1) / 2f, ir.bottom + r.height() * 0.15f, title)
        sub.color = fg
        fitText(sub, t2, r.width() - 28f * u, 20f * u)
        c.drawText(t2, r.centerX() - sub.measureText(t2) / 2f, ir.bottom + r.height() * 0.15f + 34f * u, sub)
    }

    private fun fitText(p: Paint, s: String, maxW: Float, size: Float) {
        p.textSize = size
        val w = p.measureText(s)
        if (w > maxW && w > 0f) p.textSize = size * maxW / w
    }

    private fun inBox(c: Canvas, r: RectF, block: () -> Unit) {
        val m = Matrix()
        m.setRectToRect(RectF(0f, 0f, 100f, 100f), r, Matrix.ScaleToFit.CENTER)
        c.save()
        c.concat(m)
        block()
        c.restore()
    }

    // stejné výrazné ikony jako dlaždice ve verzi 2.6
    private fun iconRoadbook(c: Canvas, r: RectF, fg: Int) = inBox(c, r) {
        stroke.color = Color.parseColor("#8F8F8F"); stroke.strokeWidth = 8f
        c.drawPath(PathParser.createPathFromPathData("M42,56L14,40"), stroke)
        stroke.color = fg; stroke.strokeWidth = 11f
        c.drawPath(PathParser.createPathFromPathData("M42,86V50L74,20"), stroke)
        fill.color = fg
        c.drawPath(PathParser.createPathFromPathData("M60,12L86,8L82,34Z"), fill)
        c.drawCircle(42f, 87f, 9f, fill)
    }

    private fun iconAtlas(c: Canvas, r: RectF) = inBox(c, r) {
        val trail = PathParser.createPathFromPathData("M6,80C26,30 56,88 96,18")
        stroke.color = Color.WHITE; stroke.strokeWidth = 13f
        c.drawPath(trail, stroke)
        stroke.color = Color.parseColor("#1E64D6"); stroke.strokeWidth = 7f
        c.drawPath(trail, stroke)
        val arrow = Path(PathParser.createPathFromPathData("M50,30L68,78L50,67L32,78Z"))
        fill.color = Color.parseColor("#E8742A")
        c.drawPath(arrow, fill)
        stroke.color = Color.WHITE; stroke.strokeWidth = 4f
        c.drawPath(arrow, stroke)
    }
}
