#include <jni.h>
#include "nitroscreenrecorderOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void*) {
  return margelo::nitro::nitroscreenrecorder::initialize(vm);
}
