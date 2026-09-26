const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = process.env.EXTENSION_ROOT || path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'background.js'), 'utf8');
// Run the actual readCoStar function and injected DOM reader with isolated text.
// No copied parser, network, installed extension or production records involved.
const reader = source.slice(source.indexOf('async function readCoStar('), source.indexOf('// ─── Surveys'));
const header = '100 Fixture Way\nPhoenix, AZ 85040\n';
async function scrape(text, route = 'detail/all-properties/123456/summary') {
  const tab = {id: 7, url: 'https://product.costar.com/' + route};
  const c = vm.createContext({document: {body: {innerText: text}}, chrome: {
    tabs: {query: async () => [tab]},
    scripting: {executeScript: async ({func, args}) => [{result: func(...args)}]},
  }});
  vm.runInContext(reader, c);
  return JSON.parse(JSON.stringify(await c.readCoStar()));
}
for (const [name, label, expected] of [
  ['sale', 'For Sale', ['sale']], ['lease', 'For Lease', ['lease']],
  ['both', 'For Sale\nFor Lease', ['sale','lease']], ['combined', 'For Sale/Lease', ['sale','lease']],
]) {
  for (const economic of ['', 'Rent\nWithheld\nPrice\nUpon Request', '$800000 Sale Price\nRent\n$1.20']) {
    test(name + ' evidence independent of economics: ' + (economic || 'absent'), async () => {
      assert.deepEqual((await scrape(header + 'Availabilities\n' + label + '\n' + economic)).sourceOfferings, expected);
    });
  }
}
test('economics alone never establishes either offering', async () => {
  const result = await scrape(header + '$800000 Sale Price\nRent\n$1.20');
  assert.equal(result.salePrice, '800000'); assert.equal(result.leaseRate, '1.20');
  assert.deepEqual(result.sourceOfferings, []);
});
test('navigation, history, estimates and marketing mentions are not offering evidence', async () => {
  const text = 'For Sale\nFor Lease\nSearch\n' + header + 'Building\nRBA\n20000 SF\nTransaction History\nFor Sale\nSale History\nFor Lease\nMarket Conditions\nFor Sale\nSale Notes\nFor Lease';
  assert.deepEqual((await scrape(text)).sourceOfferings, []);
});
test('availability stops before historical and marketing sections', async () => {
  assert.deepEqual((await scrape(header + 'Availabilities\nFor Sale\nPrice\nUpon Request\nTransaction History\nFor Lease')).sourceOfferings, ['sale']);
  assert.deepEqual((await scrape(header + 'Availabilities\nFor Lease\nSale Notes\nFor Sale')).sourceOfferings, ['lease']);
});
test('bullet header has explicit dual evidence without economic amounts', async () => {
  assert.deepEqual((await scrape(header + '20000 SF • For Sale • For Lease • Industrial Property')).sourceOfferings, ['sale','lease']);
});
test('negative prose does not become a current offering', async () => {
  assert.deepEqual((await scrape(header + 'Availabilities\nNot For Sale\nNo longer For Lease\nFor Sale last year')).sourceOfferings, []);
});
test('listing URLs establish the relevant side even when asking price is withheld', async () => {
  for (const side of ['sale','lease']) {
    assert.deepEqual((await scrape(header + 'Listing Details\nAsking Price\nUpon Request', `listings/for-${side}/detail/fixture/summary`)).sourceOfferings, [side]);
  }
});
test('listing URL and scoped second-side evidence produce a deduplicated union', async () => {
  assert.deepEqual((await scrape(header + 'Availabilities\nFor Lease\nFor Sale', 'listings/for-sale/detail/fixture/property')).sourceOfferings, ['sale','lease']);
});
test('selected suite with withheld rent is lease only despite sale URL and underlying dual building', async () => {
  const result = await scrape(header + 'Availabilities\nFor Sale\nFor Lease\nSpace Details\nAvailable\n1200 SF\nSuite\n101\nRent\nWithheld\nDocuments', 'listings/for-sale/detail/fixture/property');
  assert.equal(result.selectedSpace.suite, '101');
  assert.deepEqual(result.sourceOfferings, ['lease']);
});
test('ambiguous multiple selected spaces require review', async () => {
  assert.deepEqual((await scrape(header + 'Space Details\nSuite\n101\nSpace Details\nSuite\n102')).sourceOfferings, []);
});
test('historical unavailable selected suite is not current availability', async () => {
  for (const status of ['Leased','Off Market','Withdrawn','Unavailable']) {
    assert.deepEqual((await scrape(header + 'Space Details\nSuite\n101\nLease Status\n' + status + '\nDocuments')).sourceOfferings, []);
  }
});

test('availability navigation and historical subsection labels do not leak into the current property', async () => {
  assert.deepEqual((await scrape('Availabilities\nFor Sale\n' + header + 'Building\nRBA\n20000 SF')).sourceOfferings, []);
  assert.deepEqual((await scrape(header + 'Transaction History\nAvailabilities\nFor Lease')).sourceOfferings, []);
});
