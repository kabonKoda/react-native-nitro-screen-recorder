package com.margelo.nitro.nitroscreenrecorder
  
import com.facebook.proguard.annotations.DoNotStrip

@DoNotStrip
class NitroScreenRecorder : HybridNitroScreenRecorderSpec() {
  override fun multiply(a: Double, b: Double): Double {
    return a * b
  }
}
