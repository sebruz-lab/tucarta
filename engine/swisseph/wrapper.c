/*
 * Puente minimo entre Swiss Ephemeris y JavaScript. Los resultados se
 * dejan en un buffer estatico de doubles que JS lee desde HEAPF64, asi no
 * hace falta reservar memoria en cada llamada.
 *
 * Swiss Ephemeris (c) Astrodienst AG, bajo AGPL-3.0 (ver LICENSE-swisseph).
 */
#include <emscripten.h>
#include "src/swephexp.h"

static double out[16];
static char serr[AS_MAXCH];

EMSCRIPTEN_KEEPALIVE double *tc_buffer(void) { return out; }
EMSCRIPTEN_KEEPALIVE const char *tc_error(void) { return serr; }

EMSCRIPTEN_KEEPALIVE void tc_set_ephe_path(const char *path) {
    swe_set_ephe_path(path);
}

EMSCRIPTEN_KEEPALIVE double tc_julday(int anio, int mes, int dia, double hora) {
    return swe_julday(anio, mes, dia, hora, SE_GREG_CAL);
}

/* out[0..5]: longitud, latitud, distancia y sus velocidades diarias.
 * Devuelve las flags usadas, o un valor negativo si hubo error. */
EMSCRIPTEN_KEEPALIVE int tc_calc(double jd_ut, int ipl, int iflag) {
    serr[0] = '\0';
    return swe_calc_ut(jd_ut, ipl, iflag, out, serr);
}

/* out[0..11]: cuspides 1 a 12. out[12]: ASC, out[13]: MC, out[14]: ARMC,
 * out[15]: vertex. */
EMSCRIPTEN_KEEPALIVE int tc_houses(double jd_ut, double lat, double lon, int hsys) {
    double cusps[13], ascmc[10], cusp_speed[13], ascmc_speed[10];
    int i, r;
    serr[0] = '\0';
    r = swe_houses_ex2(jd_ut, 0, lat, lon, hsys, cusps, ascmc,
                       cusp_speed, ascmc_speed, serr);
    for (i = 1; i <= 12; i++) out[i - 1] = cusps[i];
    out[12] = ascmc[SE_ASC];
    out[13] = ascmc[SE_MC];
    out[14] = ascmc[SE_ARMC];
    out[15] = ascmc[SE_VERTEX];
    return r;
}
