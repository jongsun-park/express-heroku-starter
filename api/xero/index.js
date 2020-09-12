import express from "express";
import * as xeroCtrl from "./xero.ctrl";

const xeroRouter = express.Router();

// xeroRouter.get("/", xeroCtrl.print);
// http://localhost:5000/xero/
// http://localhost:5000/xero/callback
xeroRouter.get("/", xeroCtrl.auth);
xeroRouter.get("/callback", xeroCtrl.callback);
xeroRouter.get("/refresh-token", xeroCtrl.refreshToken);
xeroRouter.get("/disconnect", xeroCtrl.disconnect);
xeroRouter.get("/invoices", xeroCtrl.invoices);
xeroRouter.get("/attachment-invoice", xeroCtrl.attachmentInvoice);
xeroRouter.get("/purchaseorders", xeroCtrl.purchaseorders);
xeroRouter.get("/quotes", xeroCtrl.quotes);

export default xeroRouter;
