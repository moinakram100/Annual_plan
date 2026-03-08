sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/m/MessageToast"
], function (Controller, JSONModel, History, MessageBox, MessageToast) {
    "use strict";

    var MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

    var QTR_MONTHS = {
        Q1: ["jan","feb","mar"],
        Q2: ["apr","may","jun"],
        Q3: ["jul","aug","sep"],
        Q4: ["oct","nov","dec"]
    };

    return Controller.extend("com.ingenx.annualplan.controller.Approval", {
        onInit: function () {
            var oModel = new JSONModel(
                sap.ui.require.toUrl("com/ingenx/annualplan/model/approvalData.json")
            );
            oModel.attachRequestCompleted(function () {
                this._refreshSummaryCounts();
                if (this._pendingNavData) {
                    this._applyDashboardFilter(this._pendingNavData);
                    this._pendingNavData = null;
                }
            }.bind(this));
            this.getView().setModel(oModel, "apv");

            this.getOwnerComponent().getRouter()
                .getRoute("onRouteApproval")
                .attachPatternMatched(this._onRouteMatched, this);

            sap.ui.getCore().getEventBus().subscribe(
                "com.ingenx.annualplan",
                "NavigateToApproval",
                this._onDashboardNavData,
                this
            );
        },

        // EventBus handler — fires just BEFORE route match — store for later
        _onDashboardNavData: function (sChannel, sEvent, oData) {
            this._pendingNavData = oData;
        },

        // Route handler — fires just AFTER EventBus — pick up stored data
        _onRouteMatched: function () {
            if (!this._pendingNavData) return; 
            var oModel = this.getView().getModel("apv");
            if (oModel.getProperty("/approvalRequests")) {
                this._applyDashboardFilter(this._pendingNavData);
                this._pendingNavData = null;
            }
            // else: requestCompleted above will handle it
        },

        // Pre-fill customer/material filters and auto-load results
        _applyDashboardFilter: function (oData) {
            var oModel = this.getView().getModel("apv");
            // customerId = "CUST-1001" 
            // customer   = "ABC Power Ltd"
            oModel.setProperty("/filters/customer",    oData.customerId || "");
            oModel.setProperty("/filters/material",    oData.material   || "");
            oModel.setProperty("/filters/requestType", "");
            oModel.setProperty("/filters/status",      "");
            this._applyFilterInternal();
            MessageToast.show("Showing requests for: " + (oData.customer || oData.customerId || "selected plan"));
        },

        onExit: function () {
            sap.ui.getCore().getEventBus().unsubscribe(
                "com.ingenx.annualplan",
                "NavigateToApproval",
                this._onDashboardNavData,
                this
            );
        },

        //  FILTER BAR 
        onLoadAll: function () {
            var oModel = this.getView().getModel("apv");
            oModel.setProperty("/filters", { requestType:"", status:"", material:"", customer:"" });
            this._applyFilterInternal();
            MessageToast.show("All approval requests loaded.");
        },

        onApplyFilter: function () {
            this._applyFilterInternal();
        },

        onClearFilter: function () {
            var oModel = this.getView().getModel("apv");
            oModel.setProperty("/filters", { requestType:"", status:"", material:"", customer:"" });
            oModel.setProperty("/filteredRequests", []);
            oModel.setProperty("/ui/dataLoaded",    false);
            oModel.setProperty("/ui/detailVisible", false);
            MessageToast.show("Filters cleared.");
        },

        _applyFilterInternal: function () {
            var oModel = this.getView().getModel("apv");
            var oF     = oModel.getProperty("/filters");
            var aAll   = oModel.getProperty("/approvalRequests");

            var aFiltered = aAll.filter(function (r) {
                if (oF.requestType && r.type       !== oF.requestType) return false;
                if (oF.status      && r.status      !== oF.status)      return false;
                if (oF.material    && r.material    !== oF.material)    return false;
                if (oF.customer    && r.customerId  !== oF.customer)    return false;
                return true;
            });

            oModel.setProperty("/filteredRequests", aFiltered);
            oModel.setProperty("/ui/dataLoaded",    true);
            oModel.setProperty("/ui/detailVisible", false);
        },

        onRefresh: function () {
            var oModel = this.getView().getModel("apv");
            oModel.setProperty("/ui/busy", true);
            setTimeout(function () {
                this._applyFilterInternal();
                this._refreshSummaryCounts();
                oModel.setProperty("/ui/busy", false);
                MessageToast.show("Refreshed.");
            }.bind(this), 500);
        },

        onExport: function () {
            MessageToast.show("Export – connect to sap.ui.export.Spreadsheet in CAPM build.");
        },

        onRequestIdPress: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("apv");
            this._openDetail(oCtx.getObject(), oCtx.getPath());
        },

        onReviewRequest: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("apv");
            this._openDetail(oCtx.getObject(), oCtx.getPath());
        },

        onTableSelectionChange: function () {
            var oTable = this.byId("requestsTable");
            var aIdx   = oTable.getSelectedIndices();
            if (aIdx.length !== 1) return;
            var oModel   = this.getView().getModel("apv");
            var aRecords = oModel.getProperty("/filteredRequests");
            var oRec     = aRecords[aIdx[0]];
            var sPath    = "/filteredRequests/" + aIdx[0];
            this._openDetail(oRec, sPath);
        },

        _openDetail: function (oReq, sPath) {
            var oModel    = this.getView().getModel("apv");
            var oSelected = jQuery.extend(true, {}, oReq);
            oSelected._sourcePath = sPath;

            var oMP  = oReq.monthlyPlan;
            var oQT  = oReq.quarterlyTotals;
            var oLim = oReq.quarterlyLimits;

            var oMonthState = {};
            ["Q1","Q2","Q3","Q4"].forEach(function (q, qi) {
                var sQtrState = oQT["q" + (qi + 1) + "State"];
                QTR_MONTHS[q].forEach(function (m) { oMonthState[m] = sQtrState; });
            });

            oSelected.monthlyRow = [{
                jan: oMP.jan, feb: oMP.feb, mar: oMP.mar,
                apr: oMP.apr, may: oMP.may, jun: oMP.jun,
                jul: oMP.jul, aug: oMP.aug, sep: oMP.sep,
                oct: oMP.oct, nov: oMP.nov, dec: oMP.dec,
                q1: oQT.q1, q1State: oQT.q1State,
                q2: oQT.q2, q2State: oQT.q2State,
                q3: oQT.q3, q3State: oQT.q3State,
                q4: oQT.q4, q4State: oQT.q4State,
                annual: oReq.annualTotal,
                janState: oMonthState.jan, febState: oMonthState.feb, marState: oMonthState.mar,
                aprState: oMonthState.apr, mayState: oMonthState.may, junState: oMonthState.jun,
                julState: oMonthState.jul, augState: oMonthState.aug, sepState: oMonthState.sep,
                octState: oMonthState.oct, novState: oMonthState.nov, decState: oMonthState.dec
            }];

            oModel.setProperty("/selectedRequest",  oSelected);
            oModel.setProperty("/ui/detailVisible", true);

            setTimeout(function () {
                var oPanel = this.byId("detailPanel");
                if (oPanel && oPanel.getDomRef()) {
                    oPanel.getDomRef().scrollIntoView({ behavior:"smooth", block:"start" });
                }
            }.bind(this), 150);
        },

        onApproveInline: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("apv");
            var oReq = oCtx.getObject();
            this._confirmApprove([{ req: oReq, path: oCtx.getPath() }]);
        },

        onRejectInline: function (oEvent) {
            var oCtx = oEvent.getSource().getBindingContext("apv");
            var oReq = oCtx.getObject();
            this._openDetail(oReq, oCtx.getPath());
            MessageToast.show("Enter a comment below, then click 'Reject with Comment'.");
        },

        onApproveDetail: function () {
            var oModel = this.getView().getModel("apv");
            var oSel   = oModel.getProperty("/selectedRequest");
            if (!oSel || oSel.status !== "PENDING") return;
            this._confirmApprove([{ req: oSel, path: oSel._sourcePath }]);
        },

        onRejectDetail: function () {
            var oModel   = this.getView().getModel("apv");
            var oSel     = oModel.getProperty("/selectedRequest");
            if (!oSel || oSel.status !== "PENDING") return;
            var sComment = (oSel.approverComment || "").trim();
            if (!sComment) {
                MessageBox.warning(
                    "A comment is required when rejecting a request.\n" +
                    "Please enter your reason in the 'Approver Comments' field."
                );
                var oTA = this.byId("approverCommentInput");
                if (oTA) oTA.focus();
                return;
            }
            this._confirmReject([{ req: oSel, path: oSel._sourcePath, comment: sComment }]);
        },

        onBulkApprove: function () {
            var aSelected = this._getSelectedPending();
            if (aSelected.length === 0) {
                MessageBox.information("Please select one or more Pending requests from the table.");
                return;
            }
            this._confirmApprove(aSelected);
        },

        onBulkReject: function () {
            var aSelected = this._getSelectedPending();
            if (aSelected.length === 0) {
                MessageBox.information("Please select one or more Pending requests from the table.");
                return;
            }
            var oDialog = new sap.m.Dialog({
                title:   "Bulk Reject – Enter Reason",
                type:    sap.m.DialogType.Message,
                state:   sap.ui.core.ValueState.Error,
                content: [
                    new sap.m.Text({ text: aSelected.length + " request(s) will be rejected." }),
                    new sap.m.TextArea({
                        id:          this.getView().createId("bulkRejectComment"),
                        placeholder: "Rejection reason (mandatory)…",
                        rows:        3,
                        width:       "100%",
                        class:       "sapUiSmallMarginTop"
                    })
                ],
                beginButton: new sap.m.Button({
                    text:  "Reject",
                    type:  sap.m.ButtonType.Reject,
                    press: function () {
                        var sComment = sap.ui.getCore().byId(this.getView().createId("bulkRejectComment")).getValue().trim();
                        if (!sComment) { MessageToast.show("Please enter a rejection reason."); return; }
                        aSelected.forEach(function (o) { o.comment = sComment; });
                        this._confirmReject(aSelected);
                        oDialog.close();
                        oDialog.destroy();
                    }.bind(this)
                }),
                endButton: new sap.m.Button({
                    text: "Cancel",
                    press: function () { oDialog.close(); oDialog.destroy(); }
                })
            });
            oDialog.open();
        },

        _confirmApprove: function (aItems) {
            var n     = aItems.length;
            var sDesc = n === 1
                ? aItems[0].req.contract + " – " + aItems[0].req.customer
                : n + " request(s)";

            MessageBox.confirm(
                "Approve " + sDesc + "?\n\n" +
                "Upon approval (per FS Step 7):\n" +
                "  • Notifications sent to Customer and Zonal Office\n" +
                "  • Contract quantities updated: ACQ and MCQ (month-wise)\n" +
                "  • DCQ recalculated automatically for each month\n" +
                "  • All updates applied without manual intervention\n\nProceed?",
                {
                    title: "Confirm Approval",
                    icon:  MessageBox.Icon.SUCCESS,
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.OK) return;
                        aItems.forEach(function (o) {
                            this._persistDecision(o.req, o.path, "APPROVED", o.comment || "");
                        }.bind(this));
                        this._afterDecisionBatch(aItems.length, "Approved");
                    }.bind(this)
                }
            );
        },

        _confirmReject: function (aItems) {
            var n     = aItems.length;
            var sDesc = n === 1
                ? aItems[0].req.contract + " – " + aItems[0].req.customer
                : n + " request(s)";

            MessageBox.confirm(
                "Reject " + sDesc + "?\n\nThe submitter will be notified with the comment provided.",
                {
                    title: "Confirm Rejection",
                    icon:  MessageBox.Icon.WARNING,
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.OK) return;
                        aItems.forEach(function (o) {
                            this._persistDecision(o.req, o.path, "REJECTED", o.comment || "");
                        }.bind(this));
                        this._afterDecisionBatch(aItems.length, "Rejected");
                    }.bind(this)
                }
            );
        },

        _persistDecision: function (oReq, sPath, sStatus, sComment) {
            var oModel     = this.getView().getModel("apv");
            var sText      = sStatus === "APPROVED" ? "Approved" : "Rejected";
            var sState     = sStatus === "APPROVED" ? "Success"  : "Error";
            var sStepState = sStatus === "APPROVED" ? "DONE"     : "REJECTED";
            var sCtrState  = sStatus === "APPROVED" ? "DONE"     : "SKIPPED";
            var sToday     = this._todayString();

            if (sPath) {
                oModel.setProperty(sPath + "/status",          sStatus);
                oModel.setProperty(sPath + "/statusText",      sText);
                oModel.setProperty(sPath + "/statusState",     sState);
                oModel.setProperty(sPath + "/approverComment", sComment);
                oModel.setProperty(sPath + "/daysWaiting",     0);
                oModel.setProperty(sPath + "/workflowSteps/2/status", sStepState);
                oModel.setProperty(sPath + "/workflowSteps/2/date",   sToday);
                oModel.setProperty(sPath + "/workflowSteps/2/by",     "Corporate Team");
                oModel.setProperty(sPath + "/workflowSteps/3/status", sCtrState);
                if (sStatus === "APPROVED") {
                    oModel.setProperty(sPath + "/workflowSteps/3/date", sToday);
                    oModel.setProperty(sPath + "/workflowSteps/3/by",   "System (Auto)");
                }
            }

            var oSel = oModel.getProperty("/selectedRequest");
            if (oSel && oSel.requestId === oReq.requestId) {
                oModel.setProperty("/selectedRequest/status",          sStatus);
                oModel.setProperty("/selectedRequest/statusText",      sText);
                oModel.setProperty("/selectedRequest/statusState",     sState);
                oModel.setProperty("/selectedRequest/approverComment", sComment);
                oModel.setProperty("/selectedRequest/daysWaiting",     0);
                oModel.setProperty("/selectedRequest/workflowSteps/2/status", sStepState);
                oModel.setProperty("/selectedRequest/workflowSteps/2/date",   sToday);
                oModel.setProperty("/selectedRequest/workflowSteps/2/by",     "Corporate Team");
                oModel.setProperty("/selectedRequest/workflowSteps/3/status", sCtrState);
                if (sStatus === "APPROVED") {
                    oModel.setProperty("/selectedRequest/workflowSteps/3/date", sToday);
                    oModel.setProperty("/selectedRequest/workflowSteps/3/by",   "System (Auto)");
                }
            }

            this._syncMasterRecord(oReq.requestId, sStatus, sText, sState, sComment, sToday, sStepState, sCtrState);

            if (sStatus === "APPROVED") {
                this._simulatePostApprovalProcessing(oReq);
            }
        },

        _syncMasterRecord: function (sRequestId, sStatus, sText, sState, sComment, sToday, sStepState, sCtrState) {
            var oModel = this.getView().getModel("apv");
            var aAll   = oModel.getProperty("/approvalRequests");
            var iIdx   = aAll.findIndex(function (r) { return r.requestId === sRequestId; });
            if (iIdx < 0) return;
            var sBase  = "/approvalRequests/" + iIdx;
            oModel.setProperty(sBase + "/status",          sStatus);
            oModel.setProperty(sBase + "/statusText",      sText);
            oModel.setProperty(sBase + "/statusState",     sState);
            oModel.setProperty(sBase + "/approverComment", sComment);
            oModel.setProperty(sBase + "/daysWaiting",     0);
            oModel.setProperty(sBase + "/workflowSteps/2/status", sStepState);
            oModel.setProperty(sBase + "/workflowSteps/2/date",   sToday);
            oModel.setProperty(sBase + "/workflowSteps/2/by",     "Corporate Team");
            oModel.setProperty(sBase + "/workflowSteps/3/status", sCtrState);
            if (sStatus === "APPROVED") {
                oModel.setProperty(sBase + "/workflowSteps/3/date", sToday);
                oModel.setProperty(sBase + "/workflowSteps/3/by",   "System (Auto)");
            }
        },

        _simulatePostApprovalProcessing: function (oReq) {
            var DAYS = { jan:31,feb:28,mar:31,apr:30,may:31,jun:30,jul:31,aug:31,sep:30,oct:31,nov:30,dec:31 };
            var oMP  = oReq.monthlyPlan;
            var sDCQ = Object.keys(DAYS).map(function (m) {
                return m.toUpperCase() + ":" + (oMP[m] / DAYS[m]).toFixed(2);
            }).join(" | ");
            console.info(
                "[iGMS Post-Approval] Step 7 processing for " + oReq.requestId + "\n" +
                "  Notifications : Customer (" + oReq.customer + ") + Zonal (" + oReq.salesOffice + ")\n" +
                "  ACQ Updated   : " + oReq.contractInfo.acq + " → " + oReq.aacq + " " + oReq.uom + "\n" +
                "  MCQ Updated   : " + JSON.stringify(oMP) + "\n" +
                "  DCQ Calc      : " + sDCQ
            );
        },

        _afterDecisionBatch: function (n, sVerb) {
            this._refreshSummaryCounts();
            var oModel   = this.getView().getModel("apv");
            var iPending = oModel.getProperty("/ui/pendingCount");
            MessageBox.success(
                n + " request(s) " + sVerb + " successfully.\n\n" +
                (sVerb === "Approved"
                    ? "Notifications have been sent to Customer and Zonal Office.\n" +
                      "Contract quantities (ACQ, MCQ, DCQ) will be updated by the system."
                    : "The submitter has been notified with the rejection comment.") +
                "\n\nRemaining pending: " + iPending + " request(s).",
                {
                    title: sVerb + " Successful",
                    onClose: function () { this._applyFilterInternal(); }.bind(this)
                }
            );
        },

        _getSelectedPending: function () {
            var oTable   = this.byId("requestsTable");
            var aIdx     = oTable.getSelectedIndices();
            var oModel   = this.getView().getModel("apv");
            var aRecords = oModel.getProperty("/filteredRequests");
            return aIdx
                .map(function (i) { return { req: aRecords[i], path: "/filteredRequests/" + i }; })
                .filter(function (o) { return o.req.status === "PENDING"; });
        },

        _refreshSummaryCounts: function () {
            var oModel = this.getView().getModel("apv");
            var aAll   = oModel.getProperty("/approvalRequests") || [];
            oModel.setProperty("/ui/pendingCount",  aAll.filter(function (r) { return r.status === "PENDING";  }).length);
            oModel.setProperty("/ui/approvedCount", aAll.filter(function (r) { return r.status === "APPROVED"; }).length);
            oModel.setProperty("/ui/rejectedCount", aAll.filter(function (r) { return r.status === "REJECTED"; }).length);
        },

        _todayString: function () {
            var d  = new Date();
            var mm = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
            return d.getDate() + " " + mm[d.getMonth()] + " " + d.getFullYear();
        },

        onPressNavBack: function () {
            var oHistory      = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("onRouteDashboard", {}, true);
            }
        }

    });
});