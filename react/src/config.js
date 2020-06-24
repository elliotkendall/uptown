const productionHostname = 'foo';
const productionAPIURL = 'wss://97d1j792wf.execute-api.us-east-1.amazonaws.com/default';
const developmentAPIURL = 'wss://97d1j792wf.execute-api.us-east-1.amazonaws.com/default';

export const EMOJI = {
  "~": "🎩",
  "!": "💍",
  "@": "👩",
  "#": "💡",
  "?": "🏙",
  "%": "🎷",
  "^": "🚗",
  "&": "🃏",
  "*": "🍾",
};

// Don't edit below this line
const hostname = window && window.location && window.location.hostname;

export let APIURL;
if (hostname === productionHostname) {
  APIURL = productionAPIURL;
} else {
  console.log('Running in development mode');
  APIURL = developmentAPIURL;
}
