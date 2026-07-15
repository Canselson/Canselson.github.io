// Maps a player's "country" string to a flagcdn.com code for the flag icon.
// Extend this if you add players from a country not listed here.
export const COUNTRY_CODES = {
  England:            'gb-eng',
  Scotland:           'gb-sct',
  Wales:              'gb-wls',
  'Northern Ireland': 'gb-nir',
  Ireland:            'ie',
  'United Kingdom':   'gb',
  USA:                'us',
  'United States':    'us',
  Canada:             'ca',
  France:             'fr',
  Germany:            'de',
  Spain:              'es',
  Italy:              'it',
  Poland:             'pl',
  Netherlands:        'nl',
  Sweden:             'se',
  Norway:             'no',
  Finland:            'fi',
  Denmark:            'dk',
  Australia:          'au',
  'New Zealand':      'nz',
  China:              'cn',
  India:              'in',
  Nigeria:            'ng',
  'South Africa':     'za',
}

export function flagUrl(country) {
  const code = COUNTRY_CODES[country]
  return code ? `https://flagcdn.com/24x18/${code}.png` : null
}
