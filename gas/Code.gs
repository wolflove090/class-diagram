/**
 * 設計メーカーのアクセスKPIを集計するGAS Webアプリ。
 *
 * デプロイ前に SPREADSHEET_ID を集計先スプレッドシートのIDへ置き換える。
 */
const SPREADSHEET_ID = "PASTE_YOUR_SPREADSHEET_ID_HERE";
const TIME_ZONE = "Asia/Tokyo";
const DAILY_KPI_SHEET_NAME = "DailyKPI";
const VISITOR_LOG_SHEET_NAME = "VisitorLog";

function doPost(event) {
  try {
    validateConfiguration();

    const payload = parsePayload(event);
    const clientId = payload.clientId;
    if (!isValidClientId(clientId)) {
      return jsonResponse({ ok: false, error: "invalid_client_id" });
    }

    const date = Utilities.formatDate(new Date(), TIME_ZONE, "yyyy-MM-dd");
    const visitorKey = date + ":" + hashClientId(clientId);
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
      const dailyKpiSheet = getOrCreateDailyKpiSheet(spreadsheet);
      const visitorLogSheet = getOrCreateVisitorLogSheet(spreadsheet);

      if (hasVisitorKey(visitorLogSheet, visitorKey)) {
        return jsonResponse({ ok: true, counted: false, date: date });
      }

      appendVisitorKey(visitorLogSheet, visitorKey);
      const displayCount = incrementDailyCount(dailyKpiSheet, date);
      return jsonResponse({ ok: true, counted: true, date: date, displayCount: displayCount });
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    console.error(error);
    return jsonResponse({ ok: false, error: "server_error" });
  }
}

function parsePayload(event) {
  if (!event || !event.postData || !event.postData.contents) {
    throw new Error("Request body is required.");
  }

  return JSON.parse(event.postData.contents);
}

function isValidClientId(clientId) {
  return typeof clientId === "string" && clientId.length >= 16 && clientId.length <= 128;
}

function hashClientId(clientId) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, clientId);
  return bytes.map(function(byte) {
    return (byte + 256).toString(16).slice(-2);
  }).join("");
}

function getOrCreateDailyKpiSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(DAILY_KPI_SHEET_NAME);
  if (sheet) return sheet;

  sheet = spreadsheet.insertSheet(DAILY_KPI_SHEET_NAME);
  sheet.getRange(1, 1, 1, 2).setValues([["日付", "表示回数"]]);
  sheet.setFrozenRows(1);
  return sheet;
}

function getOrCreateVisitorLogSheet(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(VISITOR_LOG_SHEET_NAME);
  if (sheet) return sheet;

  sheet = spreadsheet.insertSheet(VISITOR_LOG_SHEET_NAME);
  sheet.getRange(1, 1).setValue("日付:匿名IDハッシュ");
  sheet.setFrozenRows(1);
  sheet.hideSheet();
  return sheet;
}

function hasVisitorKey(sheet, visitorKey) {
  return sheet
    .getRange("A:A")
    .createTextFinder(visitorKey)
    .matchEntireCell(true)
    .findNext() !== null;
}

function appendVisitorKey(sheet, visitorKey) {
  sheet.getRange(sheet.getLastRow() + 1, 1).setValue(visitorKey);
}

function incrementDailyCount(sheet, date) {
  const dateCell = sheet
    .getRange("A:A")
    .createTextFinder(date)
    .matchEntireCell(true)
    .findNext();

  if (!dateCell) {
    const row = sheet.getLastRow() + 1;
    sheet.getRange(row, 1, 1, 2).setValues([[date, 1]]);
    return 1;
  }

  const countCell = sheet.getRange(dateCell.getRow(), 2);
  const nextCount = Number(countCell.getValue()) + 1;
  countCell.setValue(nextCount);
  return nextCount;
}

function validateConfiguration() {
  if (SPREADSHEET_ID === "PASTE_YOUR_SPREADSHEET_ID_HERE") {
    throw new Error("Set SPREADSHEET_ID before deploying.");
  }
}

function jsonResponse(body) {
  return ContentService
    .createTextOutput(JSON.stringify(body))
    .setMimeType(ContentService.MimeType.JSON);
}
