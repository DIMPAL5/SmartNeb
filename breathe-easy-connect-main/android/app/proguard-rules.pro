# Add project-specific ProGuard rules here.
# By default, the ProGuard rules file is configured to keep all classes and members
# referenced by reflection. For example, for Kotlin serialization or Supabase deserialization.

-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Keep Supabase & Serialization classes
-keepclassmembers class * {
    @kotlinx.serialization.Serializable *;
}
-keep class kotlinx.serialization.json.** { *; }
-dontwarn kotlinx.serialization.json.**
