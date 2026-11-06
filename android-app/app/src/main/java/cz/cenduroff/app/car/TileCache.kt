package cz.cenduroff.app.car

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.os.Handler
import android.os.Looper
import android.util.LruCache
import cz.cenduroff.app.BuildConfig
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.util.Collections
import java.util.concurrent.Executors

/**
 * Dlaždice základní mapy OpenStreetMap: v paměti (posledních ~150), na disku (30 dní)
 * a stahování na pozadí. Po stažení zavolá onLoaded (na hlavním vlákně).
 */
class TileCache(context: Context, private val onLoaded: () -> Unit) {
    private val dir = File(context.cacheDir, "tiles").apply { mkdirs() }
    private val mem = LruCache<String, Bitmap>(150)
    private val pending = Collections.synchronizedSet(HashSet<String>())
    private val failed = Collections.synchronizedMap(HashMap<String, Long>())
    private val pool = Executors.newFixedThreadPool(3)
    private val main = Handler(Looper.getMainLooper())
    private var notifyQueued = false
    private val hosts = arrayOf("a", "b", "c")

    fun get(z: Int, x: Int, y: Int): Bitmap? {
        val key = "$z/$x/$y"
        mem.get(key)?.let { return it }
        request(z, x, y, key)
        return null
    }

    /** Jen z paměti (pro náhradní dlaždici z nižšího přiblížení) – nic nestahuje. */
    fun peek(z: Int, x: Int, y: Int): Bitmap? = mem.get("$z/$x/$y")

    private fun request(z: Int, x: Int, y: Int, key: String) {
        if (!pending.add(key)) return
        val f = failed[key]
        if (f != null && System.currentTimeMillis() - f < 30000) { pending.remove(key); return }
        pool.execute {
            try {
                val file = File(dir, "$z-$x-$y.png")
                var bmp: Bitmap? = null
                val fresh = file.exists() && System.currentTimeMillis() - file.lastModified() < 30L * 24 * 3600 * 1000
                if (fresh) bmp = BitmapFactory.decodeFile(file.absolutePath)
                if (bmp == null) {
                    try {
                        val host = hosts[(x + y) % hosts.size]
                        val c = URL("https://$host.tile.openstreetmap.org/$z/$x/$y.png").openConnection() as HttpURLConnection
                        c.connectTimeout = 10000
                        c.readTimeout = 15000
                        // OSM vyžaduje, aby se aplikace představila
                        c.setRequestProperty("User-Agent", "CendurOFF-Android/" + BuildConfig.VERSION_NAME + " (interni skupina)")
                        try {
                            if (c.responseCode in 200..299) {
                                val bytes = c.inputStream.use { it.readBytes() }
                                bmp = BitmapFactory.decodeByteArray(bytes, 0, bytes.size)
                                if (bmp != null) try { file.writeBytes(bytes) } catch (e: Exception) {}
                            }
                        } finally {
                            c.disconnect()
                        }
                    } catch (e: Exception) {
                        // bez signálu: aspoň starší dlaždice z disku
                        if (file.exists()) bmp = BitmapFactory.decodeFile(file.absolutePath)
                    }
                }
                if (bmp != null) {
                    mem.put(key, bmp)
                    scheduleNotify()
                } else {
                    failed[key] = System.currentTimeMillis()
                }
            } finally {
                pending.remove(key)
            }
        }
    }

    private fun scheduleNotify() {
        main.post {
            if (notifyQueued) return@post
            notifyQueued = true
            main.postDelayed({ notifyQueued = false; onLoaded() }, 120)
        }
    }

    fun shutdown() {
        pool.shutdownNow()
    }
}
