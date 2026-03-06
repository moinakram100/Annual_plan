
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/routing/History"
], function (Controller, JSONModel, MessageBox, MessageToast,History) {
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

        onInit: function () {

    var oModel = new sap.ui.model.json.JSONModel();
    this.getView().setModel(oModel, "red");

    oModel.loadData(
        sap.ui.require.toUrl("com/ingenx/annualplan/model/reductionData.json")
    );

    oModel.attachRequestCompleted(function () {

        console.log("Reduction JSON Loaded");

        var oRouter = this.getOwnerComponent().getRouter();
        oRouter.getRoute("onRouteReduction")
               .attachPatternMatched(this._onReductionMatched, this);

    }.bind(this));

},

    _onReductionMatched: function (oEvent) {
    var oArgs = oEvent.getParameter("arguments");
    var oModel = this.getView().getModel("red");

    oModel.setProperty("/filters/material",    oArgs.material);
    oModel.setProperty("/filters/salesOffice", oArgs.salesOffice);
    oModel.setProperty("/filters/customer",    oArgs.customer);
    oModel.setProperty("/filters/contract",    oArgs.contract);
    oModel.setProperty("/filters/industry",    oArgs.industry);

    this.onApplyFilter();

},

        // FILTER BAR
        onApplyFilter: function () {
            var oModel = this.getView().getModel("red");
            var oF     = oModel.getProperty("/filters");
            var aAll   = oModel.getProperty("/planRecords");
            var ZONE   = { NORTH:"North Zone", WEST:"West Zone", SOUTH:"South Zone", EAST:"East Zone" };
            var IND    = { POWER:"Power", FERTILIZER:"Fertilizer", INDUSTRIAL:"Industrial", TEXTILE:"Textile", CHEMICAL:"Chemical" };
            
            var normalize = function(str){
    return (str || "")
        .replace(/–/g, "-")
        .toLowerCase()
        .trim();
};

var aFiltered = aAll.filter(function(r) {

    if (oF.material && r.material !== oF.material)
        return false;

    if (oF.salesOffice &&
        normalize(r.salesOffice) !== normalize(oF.salesOffice))
        return false;

    if (oF.customer && r.customerId !== oF.customer)
        return false;

    if (oF.contract && r.contract !== oF.contract)
        return false;

    if (oF.industry && r.industry !== oF.industry)
        return false;

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

            onPressNavBack : function(){
                var oHistory = sap.ui.core.routing.History.getInstance();
                var sPreviousHash = oHistory.getPreviousHash();

                if (sPreviousHash !== undefined) {
                    window.history.go(-1);
                } else {
                    this.getOwnerComponent().getRouter().navTo("onRouteReduction", {}, true);
                }
            },

        //  PLAN SELECTION
        onPlanRowSelect: function () {
            var oTable   = this.byId("planListTable");
            var iIdx     = oTable.getSelectedIndex();
            if (iIdx < 0) { this._clearSelection(); return; }

            var oModel   = this.getView().getModel("red");
            var oRec     = oModel.getProperty("/filteredRecords/" + iIdx);
            var oSel     = jQuery.extend(true, {}, oRec);

            oModel.setProperty("/selectedPlan",     oSel);
            oModel.setProperty("/ui/planSelected",  true);
            oModel.setProperty("/ui/previewReady",  false);
            oModel.setProperty("/ui/submitEnabled", false);
            oModel.setProperty("/reduction/mode",          "SINGLE");
            oModel.setProperty("/reduction/monthFrom",     "jan");
            oModel.setProperty("/reduction/monthTo",       "jan");
            oModel.setProperty("/reduction/reductionPct",  10);
            this._clearPreview();
            MessageToast.show("Selected: " + oRec.contract + " – " + oRec.customer);
        },

        onModeChange:           function() { this._clearPreview(); },
        onReductionInputChange: function() { this._clearPreview(); },

        // PREVIEW REDUCTION (core algorithm)
        onPreviewReduction: function () {
            var oModel   = this.getView().getModel("red");
            var oPlan    = oModel.getProperty("/selectedPlan");
            var oRed     = oModel.getProperty("/reduction");

            if (!oPlan) { MessageBox.warning("Please select a plan first."); return; }

            var pct  = parseFloat(oRed.reductionPct) || 0;
            if (pct <= 0 || pct > 100) { MessageBox.error("Reduction % must be between 1 and 100."); return; }

            var sFrom = oRed.monthFrom;
            var sTo   = oRed.mode === "RANGE" ? oRed.monthTo : sFrom;
            var iFrom = MONTH_KEYS.indexOf(sFrom);
            var iTo   = MONTH_KEYS.indexOf(sTo);

            if (iTo < iFrom) {
                MessageBox.error("Month To cannot be before Month From.");
                return;
            }

            var aRedIdx  = [];
            for (var i = iFrom; i <= iTo; i++) aRedIdx.push(i);

            var aRemIdx  = MONTH_KEYS
                .map(function(_, idx){ return idx; })
                .filter(function(idx){ return aRedIdx.indexOf(idx) === -1; });

            if (aRemIdx.length === 0) {
                MessageBox.error("Cannot reduce all 12 months — no months remain for re-apportionment.");
                return;
            }

            var oOrig    = oPlan.currentPlan;
            var aRevised = MONTH_KEYS.map(function(k){ return oOrig[k]; });
            var totalReduced = 0;

            aRedIdx.forEach(function(idx) {
                var reducedAmt = Math.round(aRevised[idx] * pct / 100);
                totalReduced  += reducedAmt;
                aRevised[idx] -= reducedAmt;
            });

            if (totalReduced === 0) {
                MessageBox.information("Reduction results in 0 quantity change (values may be too small).");
                return;
            }

            var n          = aRemIdx.length;
            var perMonth   = Math.floor(totalReduced / n);
            var residual   = totalReduced - (perMonth * n);

            aRemIdx.forEach(function(idx, pos) {
                aRevised[idx] += perMonth;
                if (pos === n - 1) aRevised[idx] += residual;
            });

            var revisedTotal = aRevised.reduce(function(s,v){ return s+v; }, 0);
            var bIntact      = (revisedTotal === oPlan.aacq);

            var oLimits = oPlan.quarterlyLimits;
            var aRows   = MONTH_META.map(function(meta, idx) {
                var orig    = oOrig[MONTH_KEYS[idx]];
                var rev     = aRevised[idx];
                var diff    = rev - orig;
                var isRed   = aRedIdx.indexOf(idx)   !== -1;
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
                    changeText:   isRed  ? "-" + pct + "%" :
                                  isReapp ? "+" + diff + " " + oPlan.uom : "–",
                    changeState:  isRed  ? "Error" : isReapp ? "Warning" : "None",
                    rowType:      rType,
                    rowTypeLabel: rType === "REDUCED" ? "Reduced" : rType === "REAPPORTIONED" ? "Re-apportioned" : "Unchanged"
                };
            });

            var rQ1 = aRevised[0]+aRevised[1]+aRevised[2];
            var rQ2 = aRevised[3]+aRevised[4]+aRevised[5];
            var rQ3 = aRevised[6]+aRevised[7]+aRevised[8];
            var rQ4 = aRevised[9]+aRevised[10]+aRevised[11];
            var aacq = oPlan.aacq;
            var rQ1P = aacq ? parseFloat(((rQ1/aacq)*100).toFixed(1)) : 0;
            var rQ2P = aacq ? parseFloat(((rQ2/aacq)*100).toFixed(1)) : 0;
            var rQ3P = aacq ? parseFloat(((rQ3/aacq)*100).toFixed(1)) : 0;
            var rQ4P = aacq ? parseFloat(((rQ4/aacq)*100).toFixed(1)) : 0;

            oModel.setProperty("/reduction/previewRows",           aRows);
            oModel.setProperty("/reduction/totalReducedQty",       totalReduced);
            oModel.setProperty("/reduction/reapportionMonthCount", n);
            oModel.setProperty("/reduction/revisedAnnualTotal",    revisedTotal);
            oModel.setProperty("/reduction/aacqIntact",            bIntact);
            oModel.setProperty("/reduction/_revisedMonths",        aRevised);
            oModel.setProperty("/reduction/revisedQ1",             rQ1);
            oModel.setProperty("/reduction/revisedQ1Pct",          rQ1P);
            oModel.setProperty("/reduction/revisedQ1State",        this._getState(rQ1P, oLimits.q1Limit));
            oModel.setProperty("/reduction/revisedQ2",             rQ2);
            oModel.setProperty("/reduction/revisedQ2Pct",          rQ2P);
            oModel.setProperty("/reduction/revisedQ2State",        this._getState(rQ2P, oLimits.q2Limit));
            oModel.setProperty("/reduction/revisedQ3",             rQ3);
            oModel.setProperty("/reduction/revisedQ3Pct",          rQ3P);
            oModel.setProperty("/reduction/revisedQ3State",        this._getState(rQ3P, oLimits.q3Limit));
            oModel.setProperty("/reduction/revisedQ4",             rQ4);
            oModel.setProperty("/reduction/revisedQ4Pct",          rQ4P);
            oModel.setProperty("/reduction/revisedQ4State",        this._getState(rQ4P, oLimits.q4Limit));
            oModel.setProperty("/reduction/q1Limit",               oLimits.q1Limit);
            oModel.setProperty("/reduction/q2Limit",               oLimits.q2Limit);
            oModel.setProperty("/reduction/q3Limit",               oLimits.q3Limit);
            oModel.setProperty("/reduction/q4Limit",               oLimits.q4Limit);
            oModel.setProperty("/ui/previewReady",                 true);
            oModel.setProperty("/ui/submitEnabled",                false);

            if (!bIntact) {
                MessageBox.error("AACQ integrity check failed. Revised total: " + revisedTotal + " vs AACQ: " + aacq + ". Please report this issue.");
            }
        },

        // APPLY REDUCTION
        onApplyReduction: function () {
            var oModel  = this.getView().getModel("red");
            var oPlan   = oModel.getProperty("/selectedPlan");
            var oRed    = oModel.getProperty("/reduction");

            if (!oRed.aacqIntact) { MessageBox.error("Cannot apply: AACQ integrity check failed."); return; }

            var sDesc = oRed.mode === "SINGLE"
                ? MONTH_META[MONTH_KEYS.indexOf(oRed.monthFrom)].label
                : MONTH_META[MONTH_KEYS.indexOf(oRed.monthFrom)].label + " to " +
                  MONTH_META[MONTH_KEYS.indexOf(oRed.monthTo)].label;

            MessageBox.confirm(
                "Apply " + oRed.reductionPct + "% reduction for " + sDesc + "?\n\n" +
                "Reduced Qty    : " + oRed.totalReducedQty + " " + oPlan.uom + "\n" +
                "Re-apportioned : across " + oRed.reapportionMonthCount + " months\n" +
                "AACQ remains   : " + oPlan.aacq + " " + oPlan.uom + " (unchanged)\n\n" +
                "This will update the plan and enable submission for approval.",
                {
                    title: "Confirm Reduction",
                    icon:  MessageBox.Icon.WARNING,
                    onClose: function(sAction) {
                        if (sAction !== MessageBox.Action.OK) return;
                        var aRevised  = oRed._revisedMonths;
                        var oNewPlan  = {};
                        MONTH_KEYS.forEach(function(k, i){ oNewPlan[k] = aRevised[i]; });
                        oModel.setProperty("/selectedPlan/currentPlan",   oNewPlan);
                        oModel.setProperty("/reduction/reductionApplied", true);
                        oModel.setProperty("/ui/submitEnabled",           true);
                        MessageToast.show("Reduction applied successfully. Ready to submit for approval.");
                    }.bind(this)
                }
            );
        },

        //SUBMIT FOR APPROVAL 
        onSubmitForApproval: function () {
            var oModel  = this.getView().getModel("red");
            var oPlan   = oModel.getProperty("/selectedPlan");
            var oRed    = oModel.getProperty("/reduction");

            if (!oRed.reductionApplied) {
                MessageBox.warning("Please click 'Apply Reduction' before submitting.");
                return;
            }

            MessageBox.confirm(
                "Submit reduction for approval?\n\n" +
                "Contract   : " + oPlan.contract  + "\n" +
                "Customer   : " + oPlan.customer  + "\n" +
                "Material   : " + oPlan.material  + "\n" +
                "Reduced By : " + oRed.totalReducedQty + " " + oPlan.uom + "\n" +
                "AACQ       : " + oPlan.aacq + " " + oPlan.uom + " (unchanged)\n\n" +
                "No contract update will occur until the approver grants approval.",
                {
                    title: "Submit for Approval",
                    icon:  MessageBox.Icon.SUCCESS,
                    onClose: function(sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            oModel.setProperty("/ui/busy", true);
                            setTimeout(function() {
                                oModel.setProperty("/ui/busy",          false);
                                oModel.setProperty("/ui/submitEnabled", false);
                                MessageBox.success(
                                    "Reduction submitted for approval.\n\n" +
                                    "The approver has been notified. Contract quantities will be updated upon approval.\n\n" +
                                    "Contract: " + oPlan.contract + "\nCustomer: " + oPlan.customer,
                                    { title: "Submitted Successfully" }
                                );
                            }, 700);
                        }
                    }.bind(this)
                }
            );
        },

        onResetAll: function () {
            var oModel = this.getView().getModel("red");
            if (!oModel.getProperty("/ui/planSelected")) { MessageToast.show("Nothing to reset."); return; }
            MessageBox.confirm("Reset all reduction inputs and preview?", {
                onClose: function(sAction) {
                    if (sAction !== MessageBox.Action.OK) return;
                    this._clearSelection();
                    var oTable = this.byId("planListTable");
                    if (oTable) oTable.clearSelection();
                    MessageToast.show("Reset complete.");
                }.bind(this)
            });
        },

        onExport: function () { MessageToast.show("Export – connect to sap.ui.export.Spreadsheet."); },


        _clearSelection: function() {
            var oModel = this.getView().getModel("red");
            oModel.setProperty("/selectedPlan",    null);
            oModel.setProperty("/ui/planSelected", false);
            oModel.setProperty("/ui/previewReady", false);
            oModel.setProperty("/ui/submitEnabled",false);
            this._clearPreview();
        },

        _clearPreview: function() {
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

        _getState: function(pct, limit) {
            if (pct > limit)      return "Error";
            if (pct >= limit - 2) return "Warning";
            return "Success";
        }

    });
});

