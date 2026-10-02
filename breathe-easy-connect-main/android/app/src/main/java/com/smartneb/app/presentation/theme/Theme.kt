package com.smartneb.app.presentation.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

// Color definitions matching CSS
val PrimaryTeal = Color(0xFF2A8FBD)
val BackgroundLight = Color(0xFFFAFAFB)
val BackgroundDark = Color(0xFF171A21)
val SurfaceLight = Color(0xFFFFFFFF)
val SurfaceDark = Color(0xFF21242E)

val VitalGreen = Color(0xFF10B981)
val WarnYellow = Color(0xFFF59E0B)
val CriticalRed = Color(0xFFEF4444)

private val LightColorScheme = lightColorScheme(
    primary = PrimaryTeal,
    background = BackgroundLight,
    surface = SurfaceLight,
    onPrimary = Color.White,
    onBackground = Color(0xFF212121),
    onSurface = Color(0xFF212121)
)

private val DarkColorScheme = darkColorScheme(
    primary = PrimaryTeal,
    background = BackgroundDark,
    surface = SurfaceDark,
    onPrimary = Color.Black,
    onBackground = Color(0xFFF5F5F5),
    onSurface = Color(0xFFF5F5F5)
)

// Typographies
val SpaceGrotesk = FontFamily.Default // In production, loaded via Google Fonts resources
val DMSans = FontFamily.Default

val Typography = androidx.compose.material3.Typography(
    headlineLarge = TextStyle(
        fontFamily = SpaceGrotesk,
        fontWeight = FontWeight.SemiBold,
        fontSize = 32.sp,
        letterSpacing = (-0.02).sp
    ),
    titleLarge = TextStyle(
        fontFamily = SpaceGrotesk,
        fontWeight = FontWeight.Medium,
        fontSize = 22.sp,
        letterSpacing = (-0.01).sp
    ),
    bodyLarge = TextStyle(
        fontFamily = DMSans,
        fontWeight = FontWeight.Normal,
        fontSize = 16.sp
    ),
    bodyMedium = TextStyle(
        fontFamily = DMSans,
        fontWeight = FontWeight.Normal,
        fontSize = 14.sp
    )
)

@Composable
fun SmartNebTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) DarkColorScheme else LightColorScheme

    MaterialTheme(
        colorScheme = colorScheme,
        typography = Typography,
        content = content
    )
}
