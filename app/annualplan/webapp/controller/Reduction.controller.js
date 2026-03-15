sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History"
], function (Controller, JSONModel, MessageBox, MessageToast, History) {
    "use strict";

    var MONTH_META = [
        { key:"jan", label:"January",   quarter:"Q1" },
        { key:"feb", label:"February",  quarter:"Q1" },
        { key:"mar", label:"March",     quarter:"Q1" },
        { key:"apr", label:"April",     quarter:"Q2" },
        { key:"may", label:"May",       quarter:"Q2" },
        { key:"jun", label:"June",      quarter:"Q2" },
        { key:"jul", label:"July",      quarter:"Q3" },
        { key:"aug", label:"August",    quarter:"Q3" },
        { key:"sep", label:"September", quarter:"Q3" },
        { key:"oct", label:"October",   quarter:"Q4" },
        { key:"nov", label:"November",  quarter:"Q4" },
        { key:"dec", label:"December",  quarter:"Q4" }
    ];
    var MONTH_KEYS = MONTH_META.map(function(m){ return m.key; });

    return Controller.extend("com.ingenx.annualplan.controller.Reduction", {

       // ── Component.js mein init function mein ADD karo ─────────────
// (agar already nahi hai)
/*
    init: function () {
        UIComponent.prototype.init.apply(this, arguments);

        // Shared app state model
        var oAppState = new sap.ui.model.json.JSONModel({
            reductionPlan : null,
            approvalData  : null
        });
        this.setModel(oAppState, "appState");

        this.getRouter().initialize();
    }
*/

// ── Reduction.controller.js mein REPLACE karo ─────────────────

onInit: function () {
    var oModel = new JSONModel({
        filters: {
            material: "", salesOffice: "", customer: "", contract: "", industry: ""
        },
        planRecords     : [],
        filteredRecords : [],
        selectedPlan    : null,
        ui: {
            dataLoaded   : false,
            planSelected : false,
            previewReady : false,
            submitEnabled: false,
            busy         : false
        },
        reduction: {
            mode                  : "SINGLE",
            monthFrom             : "jan",
            monthTo               : "jan",
            reductionPct          : 10,
            previewRows           : [],
            aacqIntact            : false,
            reductionApplied      : false,
            totalReducedQty       : 0,
            reapportionMonthCount : 0,
            revisedAnnualTotal    : 0,
            _revisedMonths        : null,
            revisedQ1: 0, revisedQ1Pct: 0, revisedQ1State: "None",
            revisedQ2: 0, revisedQ2Pct: 0, revisedQ2State: "None",
            revisedQ3: 0, revisedQ3Pct: 0, revisedQ3State: "None",
            revisedQ4: 0, revisedQ4Pct: 0, revisedQ4State: "None"
        }
    });
    this.getView().setModel(oModel, "red");

    this.getOwnerComponent().getRouter()
        .getRoute("onRouteReduction")
        .attachPatternMatched(this._onRouteMatched, this);
},

_onRouteMatched: function (oEvent) {
    var oArgs     = oEvent.getParameter("arguments");
    var oModel    = this.getView().getModel("red");

    // ── appState model se plan lo ─────────────────────────────
    var oComponent = this.getOwnerComponent();
    var oAppState  = oComponent.getModel("appState");

    // appState model exist nahi karta toh create karo
    if (!oAppState) {
        oAppState = new sap.ui.model.json.JSONModel({ reductionPlan: null });
        oComponent.setModel(oAppState, "appState");
    }

    var oPlan = oAppState.getProperty("/reductionPlan");

    if (oPlan) {
        // Data available hai — clear karo aur load karo
        oAppState.setProperty("/reductionPlan", null);
        this._loadPlanData(oPlan);
        return;
    }

    // ── Fallback: window check (backward compat) ──────────────
    if (window.__reductionPlan) {
        var oWinPlan = window.__reductionPlan;
        window.__reductionPlan = null;
        this._loadPlanData(oWinPlan);
        return;
    }

    // ── Koi data nahi — No Data state dikhao ─────────────────
    oModel.setProperty("/ui/dataLoaded",   false);
    oModel.setProperty("/ui/planSelected", false);
    oModel.setProperty("/ui/previewReady", false);
},

// ── Plan data load karo — ek hi jagah se ─────────────────────
_loadPlanData: function (oPlan) {
    var oModel = this.getView().getModel("red");

    oModel.setProperty("/planRecords",      [oPlan]);
    oModel.setProperty("/filteredRecords",  [oPlan]);
    oModel.setProperty("/ui/dataLoaded",    true);
    oModel.setProperty("/ui/planSelected",  false);
    oModel.setProperty("/ui/previewReady",  false);
    oModel.setProperty("/ui/submitEnabled", false);
    oModel.setProperty("/selectedPlan",     null);
    this._clearPreview();

    oModel.setProperty("/filters/contract",    oPlan.contract    || "");
    oModel.setProperty("/filters/customer",    oPlan.customerId  || "");
    oModel.setProperty("/filters/material",    oPlan.material    || "");
    oModel.setProperty("/filters/salesOffice", oPlan.salesOffice || "");
    oModel.setProperty("/filters/industry",    oPlan.industry    || "");

    // Auto-select plan
    this._autoSelectPlan(oPlan);

    sap.m.MessageToast.show("Plan loaded: " + oPlan.contract);
},
        onExit: function () {
            // cleanup placeholder — EventBus nahi use ho raha
        },

        // ════════════════════════════════════════════════════════════════
        //  EventBus handler — Dashboard row ka plan seedha yahan aata hai
        //  Dashboard ke onPressReductionBtn se publish hota hai
        // ════════════════════════════════════════════════════════════════
        _onReductionPlanReceived: function (sChannel, sEvent, oData) {
            if (!oData || !oData.plan) return;

            var oPlan  = oData.plan;
            var oModel = this.getView().getModel("red");

            // Is plan ko planRecords mein wrap karo (existing filter/table still works)
            oModel.setProperty("/planRecords",      [oPlan]);
            oModel.setProperty("/filteredRecords",  [oPlan]);
            oModel.setProperty("/ui/dataLoaded",    true);
            oModel.setProperty("/ui/planSelected",  false);
            oModel.setProperty("/ui/previewReady",  false);
            oModel.setProperty("/ui/submitEnabled", false);
            oModel.setProperty("/selectedPlan",     null);
            this._clearPreview();

            // Filter bar bhi set karo (display ke liye)
            oModel.setProperty("/filters/contract",    oPlan.contract    || "");
            oModel.setProperty("/filters/customer",    oPlan.customerId  || "");
            oModel.setProperty("/filters/material",    oPlan.material    || "");
            oModel.setProperty("/filters/salesOffice", oPlan.salesOffice || "");
            oModel.setProperty("/filters/industry",    oPlan.industry    || "");

            // ── Auto-select the plan directly — user ko manually select nahi karna ──
            this._autoSelectPlan(oPlan);

            MessageToast.show("Plan loaded: " + oPlan.contract + " – " + oPlan.customer);
        },

        // Auto-select plan aur detail panel open karo
        _autoSelectPlan: function (oPlan) {
            var oModel = this.getView().getModel("red");
            var oSel   = jQuery.extend(true, {}, oPlan);

            oModel.setProperty("/selectedPlan",           oSel);
            oModel.setProperty("/ui/planSelected",        true);
            oModel.setProperty("/ui/previewReady",        false);
            oModel.setProperty("/ui/submitEnabled",       false);
            oModel.setProperty("/reduction/mode",         "SINGLE");
            oModel.setProperty("/reduction/monthFrom",    "jan");
            oModel.setProperty("/reduction/monthTo",      "jan");
            oModel.setProperty("/reduction/reductionPct", 10);
            this._clearPreview();

            // Table mein pehli row select karo (agar table exist karta hai)
            var oTable = this.byId("planListTable");
            if (oTable) {
                oTable.setSelectedIndex(0);
            }
        },



        // ════════════════════════════════════════════════════════════════
        //  FILTER BAR (JSON fallback ke liye — unchanged)
        // ════════════════════════════════════════════════════════════════
        onApplyFilter: function () {
            var oModel = this.getView().getModel("red");
            var oF     = oModel.getProperty("/filters");
            var aAll   = oModel.getProperty("/planRecords");

            if (!aAll || !aAll.length) {
                MessageToast.show("Data not loaded yet. Please wait.");
                return;
            }

            var normalize = function (str) {
                return (str || "").replace(/–/g, "-").toLowerCase().trim();
            };

            var aFiltered = aAll.filter(function (r) {
                if (oF.material    && r.material    !== oF.material)                          return false;
                if (oF.salesOffice && normalize(r.salesOffice) !== normalize(oF.salesOffice)) return false;
                if (oF.customer    && r.customerId  !== oF.customer)                          return false;
                if (oF.contract    && r.contract    !== oF.contract)                          return false;
                if (oF.industry    && r.industry    !== oF.industry)                          return false;
                return true;
            });

            oModel.setProperty("/filteredRecords", aFiltered);
            oModel.setProperty("/ui/dataLoaded",   true);
            oModel.setProperty("/ui/planSelected", false);
            oModel.setProperty("/ui/previewReady", false);
            oModel.setProperty("/selectedPlan",    null);
            this._clearPreview();
            MessageToast.show(aFiltered.length + " approved plan(s) found.");
        },

        onClearFilter: function () {
            var oModel = this.getView().getModel("red");
            oModel.setProperty("/filters", { material:"", salesOffice:"", customer:"", contract:"", industry:"" });
            oModel.setProperty("/filteredRecords", []);
            oModel.setProperty("/ui/dataLoaded",   false);
            oModel.setProperty("/ui/planSelected", false);
            oModel.setProperty("/ui/previewReady", false);
            this._clearPreview();
            MessageToast.show("Filters cleared.");
        },

        onPressNavBack: function () {
            var oHistory      = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("onRouteDashboard", {}, true);
            }
        },

        // ════════════════════════════════════════════════════════════════
        //  PLAN ROW SELECT (table se manual select — unchanged)
        // ════════════════════════════════════════════════════════════════
        onPlanRowSelect: function () {
            var oTable = this.byId("planListTable");
            var iIdx   = oTable.getSelectedIndex();
            if (iIdx < 0) { this._clearSelection(); return; }

            var oModel = this.getView().getModel("red");
            var oRec   = oModel.getProperty("/filteredRecords/" + iIdx);
            var oSel   = jQuery.extend(true, {}, oRec);

            oModel.setProperty("/selectedPlan",           oSel);
            oModel.setProperty("/ui/planSelected",        true);
            oModel.setProperty("/ui/previewReady",        false);
            oModel.setProperty("/ui/submitEnabled",       false);
            oModel.setProperty("/reduction/mode",         "SINGLE");
            oModel.setProperty("/reduction/monthFrom",    "jan");
            oModel.setProperty("/reduction/monthTo",      "jan");
            oModel.setProperty("/reduction/reductionPct", 10);
            this._clearPreview();
            MessageToast.show("Selected: " + oRec.contract + " – " + oRec.customer);
        },

        onModeChange:           function () { this._clearPreview(); },
        onReductionInputChange: function () { this._clearPreview(); },

        // ════════════════════════════════════════════════════════════════
        //  PREVIEW REDUCTION (unchanged — exactly same logic)
        // ════════════════════════════════════════════════════════════════
        onPreviewReduction: function () {
            var oModel = this.getView().getModel("red");
            var oPlan  = oModel.getProperty("/selectedPlan");
            var oRed   = oModel.getProperty("/reduction");

            if (!oPlan) { MessageBox.warning("Please select a plan first."); return; }

            var pct = parseFloat(oRed.reductionPct) || 0;
            if (pct <= 0 || pct > 100) { MessageBox.error("Reduction % must be between 1 and 100."); return; }

            var sFrom = oRed.monthFrom;
            var sTo   = oRed.mode === "RANGE" ? oRed.monthTo : sFrom;
            var iFrom = MONTH_KEYS.indexOf(sFrom);
            var iTo   = MONTH_KEYS.indexOf(sTo);

            if (iTo < iFrom) { MessageBox.error("Month To cannot be before Month From."); return; }

            var aRedIdx = [];
            for (var i = iFrom; i <= iTo; i++) aRedIdx.push(i);

            var aRemIdx = MONTH_KEYS
                .map(function(_, idx){ return idx; })
                .filter(function(idx){ return aRedIdx.indexOf(idx) === -1; });

            if (aRemIdx.length === 0) {
                MessageBox.error("Cannot reduce all 12 months — no months remain for re-apportionment.");
                return;
            }

            var oOrig    = oPlan.currentPlan;
            var aRevised = MONTH_KEYS.map(function(k){ return oOrig[k] || 0; });
            var totalReduced = 0;

            aRedIdx.forEach(function(idx){
                var reducedAmt = Math.round(aRevised[idx] * pct / 100);
                totalReduced  += reducedAmt;
                aRevised[idx] -= reducedAmt;
            });

            if (totalReduced === 0) {
                MessageBox.information("Reduction results in 0 quantity change.");
                return;
            }

                var n        = aRemIdx.length;
                var perMonth = Math.floor(totalReduced / n);
                var residual = totalReduced - (perMonth * n);

                aRemIdx.forEach(function(idx, pos){
                    aRevised[idx] += perMonth;
                    if (pos < residual) aRevised[idx] += 1;  // ← sirf ye line change hui
                });

            var revisedTotal = aRevised.reduce(function(s,v){ return s+v; }, 0);
            var bIntact      = (revisedTotal === oPlan.aacq);
            var oLimits      = oPlan.quarterlyLimits;

            var aRows = MONTH_META.map(function(meta, idx){
                var orig    = oOrig[MONTH_KEYS[idx]] || 0;
                var rev     = aRevised[idx];
                var diff    = rev - orig;
                var isRed   = aRedIdx.indexOf(idx) !== -1;
                var isReapp = aRemIdx.indexOf(idx) !== -1 && diff !== 0;
                var rType   = isRed ? "REDUCED" : isReapp ? "REAPPORTIONED" : "UNCHANGED";
                return {
                    monthKey:     MONTH_KEYS[idx],
                    monthLabel:   meta.label,
                    quarter:      meta.quarter,
                    uom:          oPlan.uom,
                    originalQty:  orig,
                    revisedQty:   rev,
                    diff:         diff,
                    diffText:     (diff > 0 ? "+" : "") + diff + " " + oPlan.uom,
                    diffState:    diff < 0 ? "Error" : diff > 0 ? "Warning" : "None",
                    changeText:   isRed ? "-" + pct + "%" : isReapp ? "+" + diff + " " + oPlan.uom : "–",
                    changeState:  isRed ? "Error" : isReapp ? "Warning" : "None",
                    rowType:      rType,
                    rowTypeLabel: rType === "REDUCED" ? "Reduced" : rType === "REAPPORTIONED" ? "Re-apportioned" : "Unchanged"
                };
            });

            var rQ1=aRevised[0]+aRevised[1]+aRevised[2];
            var rQ2=aRevised[3]+aRevised[4]+aRevised[5];
            var rQ3=aRevised[6]+aRevised[7]+aRevised[8];
            var rQ4=aRevised[9]+aRevised[10]+aRevised[11];
            var aacq = oPlan.aacq;

            oModel.setProperty("/reduction/previewRows",           aRows);
            oModel.setProperty("/reduction/totalReducedQty",       totalReduced);
            oModel.setProperty("/reduction/reapportionMonthCount", n);
            oModel.setProperty("/reduction/revisedAnnualTotal",    revisedTotal);
            oModel.setProperty("/reduction/aacqIntact",            bIntact);
            oModel.setProperty("/reduction/_revisedMonths",        aRevised);
            oModel.setProperty("/reduction/revisedQ1",             rQ1);
            oModel.setProperty("/reduction/revisedQ1Pct",          aacq ? parseFloat(((rQ1/aacq)*100).toFixed(1)) : 0);
            oModel.setProperty("/reduction/revisedQ1State",        this._getState(rQ1/aacq*100, oLimits.q1Limit));
            oModel.setProperty("/reduction/revisedQ2",             rQ2);
            oModel.setProperty("/reduction/revisedQ2Pct",          aacq ? parseFloat(((rQ2/aacq)*100).toFixed(1)) : 0);
            oModel.setProperty("/reduction/revisedQ2State",        this._getState(rQ2/aacq*100, oLimits.q2Limit));
            oModel.setProperty("/reduction/revisedQ3",             rQ3);
            oModel.setProperty("/reduction/revisedQ3Pct",          aacq ? parseFloat(((rQ3/aacq)*100).toFixed(1)) : 0);
            oModel.setProperty("/reduction/revisedQ3State",        this._getState(rQ3/aacq*100, oLimits.q3Limit));
            oModel.setProperty("/reduction/revisedQ4",             rQ4);
            oModel.setProperty("/reduction/revisedQ4Pct",          aacq ? parseFloat(((rQ4/aacq)*100).toFixed(1)) : 0);
            oModel.setProperty("/reduction/revisedQ4State",        this._getState(rQ4/aacq*100, oLimits.q4Limit));
            oModel.setProperty("/ui/previewReady",                 true);
            oModel.setProperty("/ui/submitEnabled",                false);

            if (!bIntact) {
                MessageBox.error("AACQ integrity check failed. Revised: " + revisedTotal + " vs AACQ: " + aacq);
            }
        },

        // ════════════════════════════════════════════════════════════════
        //  APPLY + SUBMIT (unchanged)
        // ════════════════════════════════════════════════════════════════
        onApplyReduction: function () {
            var oModel = this.getView().getModel("red");
            var oPlan  = oModel.getProperty("/selectedPlan");
            var oRed   = oModel.getProperty("/reduction");

            if (!oRed.aacqIntact) { MessageBox.error("Cannot apply: AACQ integrity check failed."); return; }

            var sDesc = oRed.mode === "SINGLE"
                ? MONTH_META[MONTH_KEYS.indexOf(oRed.monthFrom)].label
                : MONTH_META[MONTH_KEYS.indexOf(oRed.monthFrom)].label + " to " +
                  MONTH_META[MONTH_KEYS.indexOf(oRed.monthTo)].label;

            MessageBox.confirm(
                "Apply " + oRed.reductionPct + "% reduction for " + sDesc + "?\n\n" +
                "Reduced Qty    : " + oRed.totalReducedQty + " " + oPlan.uom + "\n" +
                "Re-apportioned : across " + oRed.reapportionMonthCount + " months\n" +
                "AACQ remains   : " + oPlan.aacq + " " + oPlan.uom,
                {
                    title: "Confirm Reduction", icon: MessageBox.Icon.WARNING,
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.OK) return;
                        var aRevised = oRed._revisedMonths;
                        var oNewPlan = {};
                        MONTH_KEYS.forEach(function(k, i){ oNewPlan[k] = aRevised[i]; });
                        oModel.setProperty("/selectedPlan/currentPlan",   oNewPlan);
                        oModel.setProperty("/reduction/reductionApplied", true);
                        oModel.setProperty("/ui/submitEnabled",           true);
                        MessageToast.show("Reduction applied. Ready to submit for approval.");
                    }.bind(this)
                }
            );
        },

onSubmitReduction: function () {
    var oModel = this.getView().getModel("red");
    var oPlan  = oModel.getProperty("/selectedPlan");
    var oRed   = oModel.getProperty("/reduction");

    if (!oRed.aacqIntact) {
        MessageBox.error("AACQ integrity check failed. Cannot submit.");
        return;
    }

    MessageBox.confirm(
        "Submit reduction for:\n" +
        "Contract : " + oPlan.contract + "\n" +
        "Reduced  : " + oRed.totalReducedQty + " " + oPlan.uom + "\n" +
        "AACQ     : " + oPlan.aacq + " " + oPlan.uom + " (unchanged)",
        {
            title           : "Confirm Reduction Submit",
            icon            : MessageBox.Icon.WARNING,
            actions         : [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: function (sAction) {
                if (sAction !== MessageBox.Action.OK) return;
                this._postReductionPlan(oPlan, oRed);
            }.bind(this)
        }
    );
},


// ── Actual OData POST ─────────────────────────────────────────
_postReductionPlan: function (oPlan, oRed) {
    var oModel    = this.getView().getModel("red");
    var aRevised  = oRed._revisedMonths; // array of 12 revised values

    if (!aRevised || aRevised.length !== 12) {
        MessageBox.error("Revised plan data missing. Please preview again.");
        return;
    }

    var MONTH_SUBS = ["JAN","FEB","MAR","APR","MAY","JUN",
                      "JUL","AUG","SEP","OCT","NOV","DEC"];
    var MONTH_KEYS = ["jan","feb","mar","apr","may","jun",
                      "jul","aug","sep","oct","nov","dec"];

    var sYear      = String(new Date().getFullYear());
    var sValidFrom = oPlan.validFrom || "";
    var sValidTo   = oPlan.validTo   || "";

    // 12 monthly rows build karo
    var aRows = MONTH_SUBS.map(function (sSub, i) {
        return {
            Period       : "M",
            Calendaryear : sYear,
            Aacq         : oPlan.aacq,
            Material     : oPlan.material,
            SubInterval  : sSub,
            Customer     : oPlan.customerId || oPlan.customer,
            ContractNo   : oPlan.contract,
            ValidFrom    : sValidFrom,
            ValidTo      : sValidTo,
            Acq          : oPlan.aacq,
            Uom          : oPlan.uom || "MBT",
            Mqvalue      : parseInt(aRevised[i]) || 0,
            Status       : "A",
            UpwardFlexper: 0,
            DnwardFlexper: 0,
            Fmdeficiency : 0,
            Makegood     : 0,
            Makeup       : 0,
            Toppercentage: 0,
            Salesoffice  : oPlan.salesOffice || ""
        };
    });

    var oPayload = {
        Material    : oPlan.material,
        Customer    : oPlan.customerId || oPlan.customer,
        ContractNo  : oPlan.contract,
        ValidFrom   : sValidFrom,
        ValidTo     : sValidTo,
        to_annualpln: aRows
    };

    console.log("Reduction Submit Payload:", JSON.stringify(oPayload, null, 2));

    oModel.setProperty("/ui/busy", true);

    var oODataModel = this.getOwnerComponent().getModel();
    var oBindList   = oODataModel.bindList("/CreateAnnualplanSet");
    var oCtx        = oBindList.create(oPayload, true);

    oCtx.created()
        .then(function () {
            oModel.setProperty("/ui/busy",          false);
            oModel.setProperty("/ui/submitEnabled", false);
            oModel.setProperty("/reduction/reductionApplied", false);

            MessageBox.success(
                "Reduction submitted successfully!\n\n" +
                "Contract : " + oPlan.contract  + "\n" +
                "Customer : " + oPlan.customer  + "\n" +
                "Reduced  : " + oRed.totalReducedQty + " " + oPlan.uom,
                {
                    title  : "Submitted Successfully",
                    onClose: function () {
                        // Dashboard pe wapas jao
                        this.getOwnerComponent().getRouter()
                            .navTo("onRouteDashboard", {}, true);
                    }.bind(this)
                }
            );
        }.bind(this))
        .catch(function (oErr) {
            oModel.setProperty("/ui/busy", false);
            var sMsg = "Submission failed.";
            try {
                if (oErr.cause && oErr.cause.message) sMsg = oErr.cause.message;
                else if (oErr.message) sMsg = oErr.message;
            } catch (e) {}
            MessageBox.error(sMsg, { title: "Submission Failed" });
        }.bind(this));
},

        onResetAll: function () {
            var oModel = this.getView().getModel("red");
            if (!oModel.getProperty("/ui/planSelected")) { MessageToast.show("Nothing to reset."); return; }
            MessageBox.confirm("Reset all reduction inputs and preview?", {
                onClose: function (sAction) {
                    if (sAction !== MessageBox.Action.OK) return;
                    this._clearSelection();
                    var oTable = this.byId("planListTable");
                    if (oTable) oTable.clearSelection();
                    MessageToast.show("Reset complete.");
                }.bind(this)
            });
        },

        onExport: function () { MessageToast.show("Export – connect to sap.ui.export.Spreadsheet."); },

        // ── PRIVATE HELPERS ───────────────────────────────────────────────
        _clearSelection: function () {
            var oModel = this.getView().getModel("red");
            oModel.setProperty("/selectedPlan",     null);
            oModel.setProperty("/ui/planSelected",  false);
            oModel.setProperty("/ui/previewReady",  false);
            oModel.setProperty("/ui/submitEnabled", false);
            this._clearPreview();
        },

        _clearPreview: function () {
            var oModel = this.getView().getModel("red");
            oModel.setProperty("/reduction/previewRows",           []);
            oModel.setProperty("/reduction/aacqIntact",            false);
            oModel.setProperty("/reduction/reductionApplied",      false);
            oModel.setProperty("/reduction/totalReducedQty",       0);
            oModel.setProperty("/reduction/reapportionMonthCount", 0);
            oModel.setProperty("/reduction/revisedAnnualTotal",    0);
            oModel.setProperty("/reduction/_revisedMonths",        null);
            oModel.setProperty("/ui/previewReady",                 false);
            oModel.setProperty("/ui/submitEnabled",                false);
        },

        _getState: function (pct, limit) {
            if (pct > limit)       return "Error";
            if (pct >= limit - 2)  return "Warning";
            return "Success";
        }
    });
});