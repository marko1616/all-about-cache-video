#version 300 es
precision highp float;

#include "@motion-canvas/core/shaders/common.glsl"

// --- Uniforms ---
// Circle data: x, y, radius
uniform vec3 u_circle1; 
uniform vec4 u_color1;

uniform vec3 u_circle2;
uniform vec4 u_color2;

uniform vec3 u_circle3;
uniform vec4 u_color3;

// Background reference color for border blending
uniform vec4 u_bg_ref_color;

// Control parameters
uniform float u_smoothness;
uniform float u_border1_w;
uniform float u_border2_w;

// --- Functions ---

float sdCircle(vec2 p, float r) {
   return length(p) - r;
}

/**
* Weighted smooth minimum function.
* Returns vec2(blended distance d, blend factor h)
* h = 0.0 means fully b, h = 1.0 means fully a
*/
vec2 smin(float a, float b, float k) {
   float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
   float d = mix(b, a, h) - k * h * (1.0 - h);
   return vec2(d, h);
}

void main() {
   vec2 p = (sourceUV - 0.5) * resolution;

   float d1 = sdCircle(p - u_circle1.xy, u_circle1.z);
   float d2 = sdCircle(p - u_circle2.xy, u_circle2.z);
   float d3 = sdCircle(p - u_circle3.xy, u_circle3.z);

   vec2 mix12 = smin(d1, d2, u_smoothness);
   float d12 = mix12.x;
   vec4 col12 = mix(u_color2, u_color1, mix12.y);

   vec2 mixFinal = smin(d12, d3, u_smoothness);
   float d = mixFinal.x;
   vec4 baseColor = mix(u_color3, col12, mixFinal.y);

   vec4 border1Color = mix(baseColor, u_bg_ref_color, 0.33);
   vec4 border2Color = mix(baseColor, u_bg_ref_color, 0.66);

   vec4 finalColor = baseColor;
   float alpha = 1.0;
   float aa = 1.5;

   float t1 = smoothstep(-aa, 0.0, d);
   finalColor = mix(finalColor, border1Color, t1);

   float t2 = smoothstep(u_border1_w - aa, u_border1_w, d);
   finalColor = mix(finalColor, border2Color, t2);

   float totalWidth = u_border1_w + u_border2_w;
   alpha = 1.0 - smoothstep(totalWidth - aa, totalWidth, d);

   outColor = finalColor * alpha - texture(sourceTexture, sourceUV);
}
