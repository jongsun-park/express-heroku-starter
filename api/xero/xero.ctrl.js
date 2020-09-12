import path from "path";
import mime from "mime-types";
import fs from "fs";
import jwtDecode from "jwt-decode";
import { getRandomNumber, authenticationData } from "./helper";

import {
  Account,
  AccountType,
  Invoice,
  Invoices,
  Contacts,
  LineAmountTypes,
  PurchaseOrders,
  XeroClient,
} from "xero-node";

require("dotenv").config();

const client_id = process.env.CLIENT_ID;
const client_secret = process.env.CLIENT_SECRET;
const redirectUrl = process.env.REDIRECT_URI;
const scopes = process.env.SCOPES;

export const xero = new XeroClient({
  clientId: client_id,
  clientSecret: client_secret,
  redirectUris: [redirectUrl],
  scopes: scopes.split(" "),
  state: "imaParam=look-at-me-go",
  httpTimeout: 3000,
});

/**
 * auth
 * callback
 */
// callback

export const auth = async (req, res) => {
  if (req && req.session && req.session.tokenSet) {
    // This reset the session and required data on the xero client after ts recompile
    await xero.setTokenSet(req.session.tokenSet);
    await xero.updateTenants(false);
  }

  try {
    const authData = authenticationData(req, res);

    // res.render("home", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      authenticated: authData,
    });
  } catch (e) {
    res.status(res.statusCode);
    // res.render("shared/error", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      error: e,
    });
  }
};

export const callback = async (req, res) => {
  try {
    // calling apiCallback will setup all the client with
    // and return the orgData of each authorized tenant
    const tokenSet = await xero.apiCallback(req.url);
    await xero.updateTenants(false);

    console.log("xero.config.state: ", xero.config.state);

    // this is where you can associate & save your
    // `tokenSet` to a user in your Database
    req.session.tokenSet = tokenSet;
    if (tokenSet.id_token) {
      const decodedIdToken = jwtDecode(tokenSet.id_token);
      req.session.decodedIdToken = decodedIdToken;
    }
    const decodedAccessToken = jwtDecode(tokenSet.access_token);
    req.session.decodedAccessToken = decodedAccessToken;
    req.session.tokenSet = tokenSet;
    req.session.allTenants = xero.tenants;
    req.session.activeTenant = xero.tenants[0];

    // res.render("callback", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      authenticated: authenticationData(req, res),
    });
  } catch (e) {
    res.status(res.statusCode);
    // res.render("shared/error", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      error: e,
    });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const tokenSet = await xero.readTokenSet();
    console.log("token expires in:", tokenSet.expires_in, "seconds");
    console.log("tokenSet.expires_at:", tokenSet.expires_at, "milliseconds");
    console.log(
      "Readable expiration:",
      new Date(tokenSet.expires_at * 1000).toLocaleString()
    );

    if (tokenSet.expires_at * 1000 < Date.now()) {
      console.log("token is currently expired: ", tokenSet);
    } else {
      console.log("tokenSet is not expired!");
    }

    // you can refresh the token using the fully initialized client levereging openid-client
    await xero.refreshToken();

    // or if you already generated a tokenSet and have a valid (< 60 days refresh token),
    // you can initialize an empty client and refresh by passing the client, secret, and refresh_token
    const newXeroClient = new XeroClient();
    const newTokenSet = await newXeroClient.refreshWithRefreshToken(
      client_id,
      client_secret,
      tokenSet.refresh_token
    );
    const decodedIdToken = jwtDecode(newTokenSet.id_token);
    const decodedAccessToken = jwtDecode(newTokenSet.access_token);

    req.session.decodedIdToken = decodedIdToken;
    req.session.decodedAccessToken = decodedAccessToken;
    req.session.tokenSet = newTokenSet;
    req.session.allTenants = xero.tenants;
    req.session.activeTenant = xero.tenants[0];

    const authData = authenticationData(req, res);

    // res.render("home", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      authenticated: authData,
    });
  } catch (e) {
    res.status(res.statusCode);
    // res.render("shared/error", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      error: e,
    });
  }
};

export const disconnect = async (req, res) => {
  try {
    const updatedTokenSet = await xero.disconnect(req.session.activeTenant.id);
    await xero.updateTenants(false);

    if (xero.tenants.length > 0) {
      const decodedIdToken = jwtDecode(updatedTokenSet.id_token);
      const decodedAccessToken = jwtDecode(updatedTokenSet.access_token);
      req.session.decodedIdToken = decodedIdToken;
      req.session.decodedAccessToken = decodedAccessToken;
      req.session.tokenSet = updatedTokenSet;
      req.session.allTenants = xero.tenants;
      req.session.activeTenant = xero.tenants[0];
    } else {
      req.session.decodedIdToken = undefined;
      req.session.decodedAccessToken = undefined;
      req.session.allTenants = undefined;
      req.session.activeTenant = undefined;
    }
    const authData = authenticationData(req, res);

    // res.render("home", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      authenticated: authData,
    });
  } catch (e) {
    res.status(res.statusCode);
    // res.render("shared/error", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      error: e,
    });
  }
};

/**
 *
 */
export const invoices = async (req, res) => {
  try {
    const brandingTheme = await xero.accountingApi.getBrandingThemes(
      req.session.activeTenant.tenantId
    );
    const num = getRandomNumber(1000000);
    const contact1 = {
      name: "Test User: " + num,
      firstName: "Rick",
      lastName: "James",
      emailAddress: req.session.decodedIdToken.email,
    };
    const newContacts = new Contacts();
    newContacts.contacts = [contact1];
    await xero.accountingApi.createContacts(
      req.session.activeTenant.tenantId,
      newContacts
    );

    const contactsResponse = await xero.accountingApi.getContacts(
      req.session.activeTenant.tenantId
    );
    const selfContact = contactsResponse.body.contacts.filter(
      (contact) => contact.emailAddress === req.session.decodedIdToken.email
    );

    const where =
      'Status=="' +
      Account.StatusEnum.ACTIVE +
      '" AND Type=="' +
      AccountType.EXPENSE +
      '"';
    const getAccountsResponse = await xero.accountingApi.getAccounts(
      req.session.activeTenant.tenantId,
      null,
      where
    );

    const invoice1 = {
      contact: {
        contactID: selfContact[0].contactID,
      },
      expectedPaymentDate: "2009-10-20T00:00:00",
      invoiceNumber: `XERO:${getRandomNumber(1000000)}`,
      reference: `REF:${getRandomNumber(1000000)}`,
      brandingThemeID: brandingTheme.body.brandingThemes[0].brandingThemeID,
      url: "https://deeplink-to-your-site.com",
      hasAttachments: true,
      currencyCode: req.session.activeTenant.baseCurrency,
      status: Invoice.StatusEnum.SUBMITTED,
      lineAmountTypes: LineAmountTypes.Inclusive,
      subTotal: 87.11,
      totalTax: 10.89,
      total: 98.0,
      date: "2009-05-27T00:00:00",
      dueDate: "2009-06-06T00:00:00",
      lineItems: [
        {
          description: "Consulting services",
          taxType: "NONE",
          quantity: 20,
          unitAmount: 100.0,
          accountCode: getAccountsResponse.body.accounts[0].code,
        },
        {
          description: "Mega Consulting services",
          taxType: "NONE",
          quantity: 10,
          unitAmount: 500.0,
          accountCode: getAccountsResponse.body.accounts[0].code,
        },
      ],
    };

    // Array of Invoices needed
    const newInvoices = new Invoices();
    newInvoices.invoices = [invoice1, invoice1];

    // CREATE ONE OR MORE INVOICES
    const createdInvoice = await xero.accountingApi.createInvoices(
      req.session.activeTenant.tenantId,
      newInvoices,
      false
    );
    // Since we are using summarizeErrors = false we get 200 OK statuscode
    // Our array of created invoices include those that succeeded and those with validation errors.
    // loop over the invoices and if it has an error, loop over the error messages
    for (let i = 0; i < createdInvoice.body.invoices.length; i++) {
      if (createdInvoice.body.invoices[i].hasErrors) {
        let errors = createdInvoice.body.invoices[i].validationErrors;
        for (let j = 0; j < errors.length; j++) {
          console.log(errors[j].message);
        }
      }
    }

    // CREATE ONE OR MORE INVOICES - FORCE Validation error with bad account code
    const updateInvoices = new Invoices();
    const invoice2 = {
      contact: {
        contactID: selfContact[0].contactID,
      },
      status: Invoice.StatusEnum.SUBMITTED,
      date: "2009-05-27T00:00:00",
      dueDate: "2009-06-06T00:00:00",
      lineItems: [
        {
          description: "Consulting services",
          taxType: "NONE",
          quantity: 20,
          unitAmount: 100.0,
          accountCode: "99999999",
        },
      ],
    };
    updateInvoices.invoices = [invoice1, invoice2];
    await xero.accountingApi.updateOrCreateInvoices(
      req.session.activeTenant.tenantId,
      updateInvoices,
      false
    );

    // GET ONE
    const getInvoice = await xero.accountingApi.getInvoice(
      req.session.activeTenant.tenantId,
      createdInvoice.body.invoices[0].invoiceID
    );
    const invoiceId = getInvoice.body.invoices[0].invoiceID;

    // UPDATE
    const newReference = {
      reference: `NEW-REF:${getRandomNumber(1000000)}`,
    };

    const invoiceToUpdate = {
      invoices: [Object.assign(invoice1, newReference)],
    };

    const updatedInvoices = await xero.accountingApi.updateInvoice(
      req.session.activeTenant.tenantId,
      invoiceId,
      invoiceToUpdate
    );

    // GET ALL
    const totalInvoices = await xero.accountingApi.getInvoices(
      req.session.activeTenant.tenantId
    );

    // res.render("invoices", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      authenticated: authenticationData(req, res),
      invoiceId,
      email: req.session.decodedIdToken.email,
      createdInvoice: createdInvoice.body.invoices[0],
      updatedInvoice: updatedInvoices.body.invoices[0],
      count: totalInvoices.body.invoices.length,
    });
  } catch (e) {
    res.status(res.statusCode);
    // res.render("shared/error", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      error: e,
    });
  }
};

export const attachmentInvoice = async (req, res) => {
  try {
    const totalInvoices = await xero.accountingApi.getInvoices(
      req.session.activeTenant.tenantId,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      ["PAID"]
    );

    // Attachments need to be uploaded to associated objects https://developer.xero.com/documentation/api/attachments
    // CREATE ATTACHMENT
    const filename = "xero-dev.png";
    const pathToUpload = path.resolve(
      __dirname,
      "../public/images/xero-dev.png"
    );
    const readStream = fs.createReadStream(pathToUpload);
    const contentType = mime.lookup(filename);

    const fileAttached = await xero.accountingApi.createInvoiceAttachmentByFileName(
      req.session.activeTenant.tenantId,
      totalInvoices.body.invoices[0].invoiceID,
      filename,
      readStream,
      true,
      {
        headers: {
          "Content-Type": contentType,
        },
      }
    );

    // res.render("attachment-invoice", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      authenticated: authenticationData(req, res),
      attachments: fileAttached.body,
    });
  } catch (e) {
    res.status(res.statusCode);
    // res.render("shared/error", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      error: e,
    });
  }
};

export const purchaseorders = async (req, res) => {
  try {
    //GET ALL
    const getPurchaseOrdersResponse = await xero.accountingApi.getPurchaseOrders(
      req.session.activeTenant.tenantId
    );

    // CREATE
    // first we need a contactID
    const getContactsResponse = await xero.accountingApi.getContacts(
      req.session.activeTenant.tenantId
    );
    const contactID = getContactsResponse.body.contacts[0].contactID;

    const newPurchaseOrder = {
      contact: {
        contactID,
      },
      date: "2020-02-07",
      deliveryDate: "2020-02-14",
      lineAmountTypes: LineAmountTypes.Exclusive,
      lineItems: [
        {
          description: "Office Chairs",
          quantity: 5.0,
          unitAmount: 120.0,
        },
      ],
    };

    const purchaseOrders = new PurchaseOrders();
    purchaseOrders.purchaseOrders = [newPurchaseOrder];
    const createPurchaseOrderResponse = await xero.accountingApi.createPurchaseOrders(
      req.session.activeTenant.tenantId,
      purchaseOrders
    );

    // GET ONE
    const getPurchaseOrderResponse = await xero.accountingApi.getPurchaseOrder(
      req.session.activeTenant.tenantId,
      createPurchaseOrderResponse.body.purchaseOrders[0].purchaseOrderID
    );

    // UPDATE
    const updatedPurchaseOrder = newPurchaseOrder;
    updatedPurchaseOrder.deliveryInstructions = "Don't forget the secret knock";
    purchaseOrders.purchaseOrders = [updatedPurchaseOrder];
    const updatePurchaseOrderResponse = await xero.accountingApi.updatePurchaseOrder(
      req.session.activeTenant.tenantId,
      getPurchaseOrderResponse.body.purchaseOrders[0].purchaseOrderID,
      purchaseOrders
    );

    // res.render("purchaseorders", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      authenticated: authenticationData(req, res),
      count: getPurchaseOrdersResponse.body.purchaseOrders.length,
      create:
        createPurchaseOrderResponse.body.purchaseOrders[0].purchaseOrderID,
      get:
        getPurchaseOrderResponse.body.purchaseOrders[0].lineItems[0]
          .description,
      update:
        updatePurchaseOrderResponse.body.purchaseOrders[0].deliveryInstructions,
    });
  } catch (e) {
    res.status(res.statusCode);
    // res.render("shared/error", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      error: e,
    });
  }
};

export const quotes = async (req, res) => {
  try {
    //GET ALL
    const getAllQuotes = await xero.accountingApi.getQuotes(
      req.session.activeTenant.tenantId
    );

    // CREATE QUOTE
    const contactsResponse = await xero.accountingApi.getContacts(
      req.session.activeTenant.tenantId
    );
    const useContact = {
      contactID: contactsResponse.body.contacts[0].contactID,
    };

    // CREATE QUOTES
    const quote = {
      date: "2020-02-05",
      quoteNumber: "QuoteNum:" + getRandomNumber(1000000),
      contact: useContact,
      lineItems: [
        {
          description: "Consulting services",
          taxType: "OUTPUT",
          quantity: 20,
          unitAmount: 100.0,
          accountCode: "200",
        },
      ],
    };
    const quotes = {
      quotes: [quote],
    };
    const createQuotes = await xero.accountingApi.updateOrCreateQuotes(
      req.session.activeTenant.tenantId,
      quotes
    );
    const quoteId = createQuotes.body.quotes[0].quoteID;

    const filename = "xero-dev.png";
    const pathToUpload = path.resolve(
      __dirname,
      "../public/images/xero-dev.png"
    );
    const readStream = fs.createReadStream(pathToUpload);
    const contentType = mime.lookup(filename);
    const addQuoteAttachment = await xero.accountingApi.createQuoteAttachmentByFileName(
      req.session.activeTenant.tenantId,
      quoteId,
      filename,
      readStream,
      {
        headers: {
          "Content-Type": contentType,
        },
      }
    );

    // GET ONE
    const getOneQuote = await xero.accountingApi.getQuote(
      req.session.activeTenant.tenantId,
      getAllQuotes.body.quotes[0].quoteID
    );
    // res.render("quotes", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      authenticated: authenticationData(req, res),
      count: getAllQuotes.body.quotes.length,
      getOneQuoteNumber: getOneQuote.body.quotes[0].quoteNumber,
      createdQuotesId: quoteId,
      addQuoteAttachment: addQuoteAttachment.body,
    });
  } catch (e) {
    res.status(res.statusCode);
    // res.render("shared/error", {
    res.send({
      consentUrl: await xero.buildConsentUrl(),
      error: e,
    });
  }
};

// https://github.com/XeroAPI/xero-node-oauth2-app/blob/master/src/app.ts
//  router.get("/currencies", async (req: Request, res: Response) => {
//  router.get("/employees", async (req: Request, res: Response) => {
//  router.get("/invoicereminders", async (req: Request, res: Response) => {
//  router.get("/invoices", async (req: Request, res: Response) => {
//  router.get("/invoice-as-pdf", async (req: Request, res: Response) => {
//  router.get("/email-invoice", async (req: Request, res: Response) => {
//  router.get("/invoices-filtered", async (req: Request, res: Response) => {
//  router.get("/attachment-invoice", async (req: Request, res: Response) => {
//  router.get("/items", async (req: Request, res: Response) => {
//  router.get("/journals", async (req: Request, res: Response) => {
//  router.get("/linked-transactions", async (req: Request, res: Response) => {
//  router.get("/manualjournals", async (req: Request, res: Response) => {
//  router.get("/organisations", async (req: Request, res: Response) => {
//  router.get("/overpayments", async (req: Request, res: Response) => {
//  router.get("/payments", async (req: Request, res: Response) => {
//  router.get("/paymentservices", async (req: Request, res: Response) => {
//  router.get("/paymentservices", async (req: Request, res: Response) => {
//  router.get("/prepayments", async (req: Request, res: Response) => {
//  router.get("/prepayments", async (req: Request, res: Response) => {
//  router.get("/purchaseorders", async (req: Request, res: Response) => {
//  router.get("/purchase-order-as-pdf", async (req: Request, res: Response) => {
//  router.get("/receipts", async (req: Request, res: Response) => {
//  router.get("/reports", async (req: Request, res: Response) => {
//  router.get("/taxrates", async (req: Request, res: Response) => {
//  router.get("/trackingcategories", async (req: Request, res: Response) => {
//  router.get("/users", async (req: Request, res: Response) => {
//  router.get("/quotes", async (req: Request, res: Response) => {

// ******************************************************************************************************************** ASSETS API
//  router.get("/assets", async (req: Request, res: Response) => {

// ******************************************************************************************************************** PROJECTS API
//  router.get("/projects", async (req: Request, res: Response) => {
//  router.get("/project-users", async (req: Request, res: Response) => {
//  router.get("/tasks", async (req: Request, res: Response) => {
//  router.get("/time", async (req: Request, res: Response) => {

// ******************************************************************************************************************** payroll-au
//  router.get("/payroll-au-employees", async (req: Request, res: Response) => {
//  router.get("/leave-application", async (req: Request, res: Response) => {
//  router.get("/pay-item", async (req: Request, res: Response) => {
//  router.get("/pay-run", async (req: Request, res: Response) => {
//  router.get("/payroll-calendar", async (req: Request, res: Response) => {
//  router.get("/superfund", async (req: Request, res: Response) => {
//  router.get("/timesheet", async (req: Request, res: Response) => {
//  router.get("/payslip", async (req: Request, res: Response) => {
//  router.get("/payroll-au-settings", async (req: Request, res: Response) => {

// ******************************************************************************************************************** BANKFEEDS API
//  router.get("/bankfeed-connections", async (req: Request, res: Response) => {
//  router.get("/bankfeed-statements", async (req: Request, res: Response) => {

// ******************************************************************************************************************** payroll-uk
//  router.get("/payroll-uk-employees", async (req: Request, res: Response) => {
//  router.get("/employment", async (req: Request, res: Response) => {
//  router.get("/employees-tax", async (req: Request, res: Response) => {
//  router.get("/employee-opening-balances", async (req: Request, res: Response) => {
//  router.get("/employees-leave", async (req: Request, res: Response) => {
//  router.get("/employees-leave-balances", async (req: Request, res: Response) => {
//  router.get("/employees-statutory-leave-balances", async (req: Request, res: Response) => {
//  router.get("/employees-statutory-leave-summary", async (req: Request, res: Response) => {
//  router.get("/employees-statutory-sick-leave", async (req: Request, res: Response) => {
//  router.get("/employees-leave-periods", async (req: Request, res: Response) => {
//  router.get("/employees-leave-types", async (req: Request, res: Response) => {
//  router.get("/employees-pay-templates", async (req: Request, res: Response) => {
//  router.get("/employer-pensions", async (req: Request, res: Response) => {
//  router.get("/deductions", async (req: Request, res: Response) => {
//  router.get("/earnings-orders", async (req: Request, res: Response) => {
//  router.get("/earnings-rates", async (req: Request, res: Response) => {
//  router.get("/leave-types", async (req: Request, res: Response) => {
//  router.get("/reimbursements", async (req: Request, res: Response) => {
//  router.get("/timesheets", async (req: Request, res: Response) => {
//  router.get("/payment-methods", async (req: Request, res: Response) => {
//  router.get("/pay-run-calendars", async (req: Request, res: Response) => {
//  router.get("/salary-wages", async (req: Request, res: Response) => {
//  router.get("/pay-runs", async (req: Request, res: Response) => {
//  router.get("/payslips", async (req: Request, res: Response) => {
//  router.get("/settings", async (req: Request, res: Response) => {
//  router.get("/tracking-categories", async (req: Request, res: Response) => {
