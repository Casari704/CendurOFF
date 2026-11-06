package cz.cenduroff.app

import android.content.ContentValues
import android.os.Build
import android.os.Environment
import android.provider.MediaStore
import android.speech.tts.TextToSpeech
import android.util.Base64
import android.webkit.JavascriptInterface
import android.widget.Toast
import cz.cenduroff.app.roadbook.RoadbookStore
import java.io.File
import java.util.Locale

/**
 * Most mezi webem a aplikací – na webu je vidět jako window.CendurApp.
 * (Metody s @JavascriptInterface běží mimo hlavní vlákno.)
 */
class AppBridge(private val activity: MainActivity) {

    // ---- hlas pro navigaci (v2.15): český převod textu na řeč z telefonu ----
    @Volatile private var ttsReady = false
    @Volatile private var ttsCzech = false
    private lateinit var tts: TextToSpeech

    init {
        tts = TextToSpeech(activity) { status ->
            if (status == TextToSpeech.SUCCESS) {
                ttsCzech = try {
                    val r = tts.setLanguage(Locale("cs", "CZ"))
                    r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED
                } catch (e: Exception) {
                    false
                }
                ttsReady = true
            }
        }
    }

    /** Má telefon český hlas? (když ne, web hraje jen tóny) */
    @JavascriptInterface
    fun hasCzechVoice(): Boolean = ttsReady && ttsCzech

    /** Přečte text česky (přeruší případnou předchozí hlášku). */
    @JavascriptInterface
    fun speak(text: String) {
        if (!ttsReady || !ttsCzech) return
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "cenduroff-" + System.currentTimeMillis())
    }

    @JavascriptInterface
    fun isApp(): Boolean = true

    @JavascriptInterface
    fun version(): String = BuildConfig.VERSION_NAME

    @JavascriptInterface
    fun keepScreenOn(on: Boolean) = activity.keepScreenOn(on)

    /** Uloží soubor (např. GPX) do složky Stažené soubory. */
    @JavascriptInterface
    fun saveFile(name: String, mime: String, base64: String) {
        val safeName = name.replace(Regex("[\\\\/:*?\"<>|]+"), "_").ifBlank { "soubor" }
        val ok = try {
            val bytes = Base64.decode(base64, Base64.DEFAULT)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, safeName)
                    put(MediaStore.Downloads.MIME_TYPE, mime)
                    put(MediaStore.Downloads.IS_PENDING, 1)
                }
                val resolver = activity.contentResolver
                val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
                    ?: throw IllegalStateException("no uri")
                resolver.openOutputStream(uri)?.use { it.write(bytes) }
                values.clear()
                values.put(MediaStore.Downloads.IS_PENDING, 0)
                resolver.update(uri, values, null, null)
            } else {
                val dir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS) ?: activity.filesDir
                File(dir, safeName).writeBytes(bytes)
            }
            true
        } catch (e: Exception) {
            false
        }
        activity.runOnUiThread {
            Toast.makeText(
                activity,
                if (ok) "Uloženo do Stažených: $safeName" else "Soubor se nepodařilo uložit.",
                Toast.LENGTH_LONG
            ).show()
        }
    }

    /** Roadbook uložený pro offline (z Roadbook NAVI) – uvidí ho i Android Auto. */
    @JavascriptInterface
    fun storeRoadbook(routeId: Int, json: String) {
        RoadbookStore(activity).save(routeId, json)
    }

    @JavascriptInterface
    fun removeRoadbook(routeId: Int) {
        RoadbookStore(activity).remove(routeId)
    }
}
