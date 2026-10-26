# AlGzawy Preview — Warehouse watcher 1.1.0 and bridge 2.4.1.6

## Included in Preview only
- Standalone `warehouse-alert-safe` engine: `pilots/engines/warehouse-alert-safe-qa.js` pinned to immutable commit `74d2899e2464c2b612cb9caf861a614b9d0071d8`.
- Installer: `pilots/algzawy-warehouse-alert-safe-preview-rc1.user.js`, version **1.1.0**.
- Independent QA bridge: `pilots/algzawy-cloud-bridge-preview-rc1.user.js`, version **2.4.1.6**, preserves resizable dimensions and stable pin-button grid.
- Subscriber portal Preview advertises `1.1.0`; admin and subscriber permissions remain separate from attack alerts.

## Usage
1. With Preview account granted **الغزااوي | تنبيه المخازن**, keep QA global ON, approve the device, install **1.1.0** and bridge **2.4.1.6**, sync and pin the warehouse script in the current Tribal Wars tab.
2. In the small AlG warehouse panel select **⚙ إعدادات الفحص**. Threshold is an integer **1 to 100 percent** (default 90); scan frequency is **10 to 300 seconds** (default 10). Click **حفظ الإعدادات**. These live locally in the game browser and are not reset by the bridge's licensing sync.
3. Open a village, or **screen=overview_villages → production** with the `#production_table` visible. The script reads `span.res.wood`, `span.res.stone`, and `span.res.iron`, plus the adjacent storage-capacity cell **for each visible table row**. Rows with missing figures or missing actual village IDs are skipped rather than fabricating information.
4. A scan occurs immediately and at the selected interval without a whole-page reload. **Important:** rereading the page every 10 seconds does **not** automatically refresh static server-generated overview values. If Tribal Wars does not update the table dynamically, the user must refresh the game overview to get new resource values; background network polling/reload is intentionally not introduced.
5. When a village's **maximum** resource utilization reaches the threshold, the runner sends a signed event through the Preview bridge, only if Telegram's warehouse opt-in is enabled, the script is licensed, its toggle is ON and its tab is pinned.
6. Alerts from the production overview are batched **up to 12 villages per Telegram message**. Up to 24 previously unreported villages are processed on each 10-second scan; the remaining eligible villages are covered by subsequent scans. Text is HTML-escaped and bounded. Backend deduplicates by subscriber and village in 6-hour buckets, while browser throttles retries. For threshold 1% with hundreds of over-threshold villages, expect **multiple** messages rather than one giant message.
7. Preview bridge resizing: use header **− / ＋** buttons to adjust width, drag the native corner resize grip to change width/height, and drag the header to reposition. Both geometry and position are remembered in the game browser. Pin/unpin buttons occupy a fixed grid column even when names wrap.

## Security and limitations
- No Production scripts, D1 databases or Cloudflare secrets were changed. PR stays Draft and QA account/entitlements unchanged.
- **No new SQL migration** required beyond the existing warehouse preference table and existing Telegram setup.
- Each event requires the preexisting signed Preview device proof and server-side subscription, global ON, separate warehouse entitlement, enabled script and Telegram opt-in. Rate limits remain enforced.
- Static/VM regression tests are **not live browser tests**. Confirm production table markup and actual village data with the user before Production promotion.
- Server accepts 1–100% for a signed, licensed warehouse observation and independently validates percentages against exact provided wood/clay/iron and storage capacity; it no longer treats the portal's previous 90% setting as an enforced threshold after a local update.
