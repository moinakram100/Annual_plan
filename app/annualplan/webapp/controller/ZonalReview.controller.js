sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (Controller, JSONModel, Filter, FilterOperator, MessageBox, MessageToast, Fragment) {
    "use strict";

    // ─── Constants ───────────────────────────────────────────────────────────
    var STATUS = {
        PENDING:      "PENDING",
        APPROVED:     "APPROVED",
        REJECTED:     "REJECTED",
        UNDER_REVIEW: "UNDER_REVIEW"
    };

    return Controller.extend("com.ingenx.annualplan.controller.ZonalReview", {

        // ════════════════════════════════════════════════════════════════════
        //  LIFECYCLE
        // ════════════════════════════════════════════════════════════════════

        onInit: function () {
            // Load JSON model (already bound via manifest), set defaults
            var oModel = this.getOwnerComponent().getModel("localData");
            this.getView().setModel(oModel);

            // Dialog models (lazy-loaded)
            this._oRejectDialog  = null;
            this._oEditDialog    = null;
            this._sEditPlanId    = null;   // planId currently being edited
        },

        // ════════════════════════════════════════════════════════════════════
        //  FILTER BAR
        // ════════════════════════════════════════════════════════════════════

        /**
         * Called when any filter Select changes – we don't auto-apply,
         * user must press "Go" to apply filters.
         */
        onFilterChange: function () {
            // Optionally show a "dirty" indicator – left as UI enhancement
        },

        /**
         * Apply all selected filter values to the plans table binding.
         */
        onApplyFilter: function () {
            var oModel   = this.getView().getModel("localData");
            var oFilters = oModel.getProperty("/filters");
            var aFilters = [];

            if (oFilters.salesOffice) {
                // salesOffice filter maps to the salesOffice text field in data
                aFilters.push(new Filter("salesOffice", FilterOperator.Contains, this._getSalesOfficeText(oFilters.salesOffice)));
            }
            if (oFilters.customer) {
                aFilters.push(new Filter("customerId", FilterOperator.EQ, oFilters.customer));
            }
            if (oFilters.contractNumber) {
                aFilters.push(new Filter("contractNumber", FilterOperator.EQ, oFilters.contractNumber));
            }
            if (oFilters.status) {
                aFilters.push(new Filter("status", FilterOperator.EQ, oFilters.status));
            }

            var oTable = this.byId("annualplansTable");
            var oBinding = oTable.getBinding("rows");
            oBinding.filter(aFilters.length ? new Filter({ filters: aFilters, and: true }) : []);

            MessageToast.show("Filter applied " + oBinding.getLength() + " plan(s) found.");
        },

        /**
         * Clear all filters and reset the table binding.
         */
        onClearFilter: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/filters", { salesOffice: "", customer: "", contractNumber: "", status: "" });

            var oTable = this.byId("plansTable");
            oTable.getBinding("rows").filter([]);
            MessageToast.show("Filters cleared.");
        },

        /**
         * Helper: resolve salesOffice key -> display text
         */
        _getSalesOfficeText: function (sKey) {
            var mMap = {
                NORTH: "North Zone",
                WEST:  "West Zone",
                SOUTH: "South Zone",
                EAST:  "East Zone"
            };
            return mMap[sKey] || sKey;
        },

        // ════════════════════════════════════════════════════════════════════
        //  TABLE ROW ACTIONS
        // ════════════════════════════════════════════════════════════════════

        /**
         * VIEW – Opens the detail panel for the selected plan (read-only).
         * @param {sap.ui.base.Event} oEvent
         */
        onViewPlan: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oPlan    = oContext.getObject();
            this._openDetailPanel(oPlan);
        },

        /**
         * EDIT – Opens the Edit Monthly Plan dialog.
         * @param {sap.ui.base.Event} oEvent
         */
        onEditPlan: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oPlan    = oContext.getObject();
            this._openEditDialog(oPlan);
        },

        /**
         * APPROVE (inline button) – Confirms and sets status to APPROVED.
         * @param {sap.ui.base.Event} oEvent
         */
        onApprovePlan: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oPlan    = oContext.getObject();
            this._confirmApprove(oPlan.planId, oPlan.customer, oContext.getPath());
        },

        /**
         * REJECT (inline button) – Opens reject dialog.
         * @param {sap.ui.base.Event} oEvent
         */
        onRejectPlanDialog: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oPlan    = oContext.getObject();
            this._openRejectDialog(oPlan, oContext.getPath());
        },

        /**
         * RE-OPEN – Resets a REJECTED plan back to PENDING.
         * @param {sap.ui.base.Event} oEvent
         */
        onReopenPlan: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var sPath    = oContext.getPath();
            var oPlan    = oContext.getObject();

            MessageBox.confirm(
                "Re-open the rejected plan for '" + oPlan.customer + "'?\nStatus will revert to Pending Review.",
                {
                    title: "Re-open Plan",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            this._setStatus(sPath, STATUS.PENDING, "Pending Review", "Warning");
                            MessageToast.show("Plan re-opened for " + oPlan.customer);
                        }
                    }.bind(this)
                }
            );
        },

        /**
         * Customer name pressed – navigate to detail (routing extension point).
         */
        onCustomerPress: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext();
            var oPlan = oContext.getObject();
            this._openDetailPanel(oPlan);
        },

        // ════════════════════════════════════════════════════════════════════
        //  BULK ACTIONS
        // ════════════════════════════════════════════════════════════════════

        /**
         * Bulk Approve all selected rows.
         */
        onBulkApprove: function () {
            var aSelected = this._getSelectedPlans();
            if (!aSelected.length) {
                MessageBox.information("Please select at least one plan to approve.");
                return;
            }
            var sPendingNames = aSelected
                .filter(function (o) { return o.plan.status === STATUS.PENDING || o.plan.status === STATUS.UNDER_REVIEW; })
                .map(function (o) { return o.plan.customer; })
                .join(", ");

            if (!sPendingNames) {
                MessageBox.information("Selected plans are not in a reviewable state.");
                return;
            }

            MessageBox.confirm(
                "Approve plans for:\n" + sPendingNames + "?",
                {
                    title: "Bulk Approve",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            aSelected.forEach(function (o) {
                                if (o.plan.status === STATUS.PENDING || o.plan.status === STATUS.UNDER_REVIEW) {
                                    this._setStatus(o.path, STATUS.APPROVED, "Approved", "Success");
                                }
                            }.bind(this));
                            this._updateSummaryCount();
                            MessageToast.show("Plans approved successfully.");
                        }
                    }.bind(this)
                }
            );
        },

        /**
         * Bulk Reject selected rows.
         */
        onBulkReject: function () {
            var aSelected = this._getSelectedPlans();
            if (!aSelected.length) {
                MessageBox.information("Please select at least one plan to reject.");
                return;
            }
            MessageBox.confirm(
                "Reject " + aSelected.length + " selected plan(s)?",
                {
                    title: "Bulk Reject",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            aSelected.forEach(function (o) {
                                if (o.plan.status === STATUS.PENDING || o.plan.status === STATUS.UNDER_REVIEW) {
                                    this._setStatus(o.path, STATUS.REJECTED, "Rejected", "Error");
                                }
                            }.bind(this));
                            this._updateSummaryCount();
                            MessageToast.show("Plans rejected.");
                        }
                    }.bind(this)
                }
            );
        },

        // ════════════════════════════════════════════════════════════════════
        //  DETAIL PANEL ACTIONS
        // ════════════════════════════════════════════════════════════════════

        /**
         * APPROVE from detail panel footer.
         */
        onApprovePlanDetail: function () {
            var oModel = this.getView().getModel();
            var oPlan  = oModel.getProperty("/selectedPlan");
            if (!oPlan) return;
            this._confirmApprove(oPlan.planId, oPlan.customer, this._getPathForPlanId(oPlan.planId));
        },

        /**
         * REJECT from detail panel footer (uses inline reason input).
         */
        onRejectPlan: function () {
            var oModel  = this.getView().getModel();
            var oPlan   = oModel.getProperty("/selectedPlan");
            var sReason = this.byId("rejectionReasonInput").getValue().trim();

            if (!sReason) {
                MessageBox.error("Please enter a rejection reason before rejecting the plan.");
                return;
            }

            var sPath = this._getPathForPlanId(oPlan.planId);
            this._setStatus(sPath, STATUS.REJECTED, "Rejected", "Error");
            oModel.setProperty(sPath + "/rejectionReason", sReason);
            oModel.setProperty("/selectedPlan/status", STATUS.REJECTED);
            oModel.setProperty("/selectedPlan/statusText", "Rejected");
            oModel.setProperty("/selectedPlan/statusState", "Error");
            oModel.setProperty("/selectedPlan/rejectionReason", sReason);
            this._updateSummaryCount();
            MessageToast.show("Plan rejected and reason recorded.");
        },

        /**
         * EDIT from detail panel footer.
         */
        onEditDetailPlan: function () {
            var oModel = this.getView().getModel();
            var oPlan  = oModel.getProperty("/selectedPlan");
            if (oPlan) this._openEditDialog(oPlan);
        },

        /**
         * SUBMIT DECISION – triggers workflow notification (stub).
         */
        onSubmitDecision: function () {
            var oModel = this.getView().getModel();
            var oPlan  = oModel.getProperty("/selectedPlan");
            if (!oPlan) return;

            MessageBox.confirm(
                "Submit the decision for '" + oPlan.customer + "'?\nThis will notify the customer and Corporate team.",
                {
                    title: "Submit Decision",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            // In CAPM: call OData action / BAPI here
                            MessageToast.show("Decision submitted. Customer and Corporate notified.");
                        }
                    }
                }
            );
        },

        // ════════════════════════════════════════════════════════════════════
        //  REJECT DIALOG (Fragment)
        // ════════════════════════════════════════════════════════════════════

        /**
         * Open Reject Dialog for a given plan.
         * @param {object} oPlan  - plan data object
         * @param {string} sPath  - model binding path of the plan
         */
        _openRejectDialog: function (oPlan, sPath) {
            var oDialogModel = new JSONModel({
                customer:        oPlan.customer,
                contractNumber:  oPlan.contractNumber,
                planId:          oPlan.planId,
                sPath:           sPath,
                rejectionReason: ""
            });

            if (!this._oRejectDialog) {
                Fragment.load({
                    id:         this.getView().getId(),
                    name:       "com.ingenx.annualplan.fragments.RejectDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oRejectDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.setModel(oDialogModel, "dialog");
                    oDialog.open();
                }.bind(this));
            } else {
                this._oRejectDialog.setModel(oDialogModel, "dialog");
                this._oRejectDialog.open();
            }
        },

        /** Confirm reject from dialog */
        onConfirmReject: function () {
            var oDialogModel = this._oRejectDialog.getModel("dialog");
            var sReason = oDialogModel.getProperty("/rejectionReason").trim();
            if (!sReason) {
                MessageBox.error("Rejection reason is mandatory.");
                return;
            }
            var sPath = oDialogModel.getProperty("/sPath");
            var oMainModel = this.getView().getModel();

            this._setStatus(sPath, STATUS.REJECTED, "Rejected", "Error");
            oMainModel.setProperty(sPath + "/rejectionReason", sReason);

            // Sync to detail panel if same plan is open
            var oSelectedPlan = oMainModel.getProperty("/selectedPlan");
            if (oSelectedPlan && oSelectedPlan.planId === oDialogModel.getProperty("/planId")) {
                oMainModel.setProperty("/selectedPlan/status", STATUS.REJECTED);
                oMainModel.setProperty("/selectedPlan/statusText", "Rejected");
                oMainModel.setProperty("/selectedPlan/statusState", "Error");
                oMainModel.setProperty("/selectedPlan/rejectionReason", sReason);
            }

            this._updateSummaryCount();
            this._oRejectDialog.close();
            MessageToast.show("Plan rejected. Reason recorded.");
        },

        /** Cancel reject dialog */
        onCancelReject: function () {
            if (this._oRejectDialog) this._oRejectDialog.close();
        },

        // ════════════════════════════════════════════════════════════════════
        //  EDIT PLAN DIALOG (Fragment)
        // ════════════════════════════════════════════════════════════════════

        /**
         * Open Edit Monthly Plan dialog.
         * @param {object} oPlan - plan data object
         */
        _openEditDialog: function (oPlan) {
            this._sEditPlanId = oPlan.planId;

            // Build edit model with live quarterly totals
            var oEditData = jQuery.extend(true, {}, oPlan);
            this._recalcEditTotals(oEditData);

            var oEditModel = new JSONModel(oEditData);

            if (!this._oEditDialog) {
                Fragment.load({
                    id:         this.getView().getId(),
                    name:       "com.ingenx.annualplan.fragments.EditPlanDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oEditDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.setModel(oEditModel, "edit");
                    oDialog.open();
                }.bind(this));
            } else {
                this._oEditDialog.setModel(oEditModel, "edit");
                this._oEditDialog.open();
            }
        },

        /**
         * Live recalculate quarterly totals and states in the edit model.
         * Called on every month Input change.
         */
        onEditMonthChange: function () {
            var oEditModel = this._oEditDialog.getModel("edit");
            var oData = oEditModel.getData();
            this._recalcEditTotals(oData);
            oEditModel.setData(oData);
        },

        /**
         * Save edited plan back to the main JSON model.
         */
        onSaveEditedPlan: function () {
            var oEditModel = this._oEditDialog.getModel("edit");
            var oEditData  = oEditModel.getData();
            var aacq       = oEditData.aacq;

            // Validate: annual total must equal AACQ
            if (oEditData.editAnnualTotal !== aacq) {
                MessageBox.error(
                    "Annual total (" + oEditData.editAnnualTotal + ") does not match AACQ (" + aacq + ").\n" +
                    "Please adjust monthly quantities so they sum to " + aacq + "."
                );
                return;
            }

            // Write changes back to main model
            var oMainModel = this.getView().getModel();
            var sPath = this._getPathForPlanId(this._sEditPlanId);
            oMainModel.setProperty(sPath + "/monthlyPlan", oEditData.monthlyPlan);
            oMainModel.setProperty(sPath + "/quarterlyTotals", {
                q1: oEditData.q1Total, q1Pct: oEditData.q1Pct, q1State: oEditData.q1State,
                q2: oEditData.q2Total, q2Pct: oEditData.q2Pct, q2State: oEditData.q2State,
                q3: oEditData.q3Total, q3Pct: oEditData.q3Pct, q3State: oEditData.q3State,
                q4: oEditData.q4Total, q4Pct: oEditData.q4Pct, q4State: oEditData.q4State
            });

            // Refresh detail panel if this plan is open
            var oSelectedPlan = oMainModel.getProperty("/selectedPlan");
            if (oSelectedPlan && oSelectedPlan.planId === this._sEditPlanId) {
                var oUpdated = oMainModel.getProperty(sPath);
                this._openDetailPanel(oUpdated);
            }

            this._oEditDialog.close();
            MessageToast.show("Monthly plan updated successfully.");
        },

        /** Cancel edit dialog */
        onCancelEditPlan: function () {
            if (this._oEditDialog) this._oEditDialog.close();
        },

        // ════════════════════════════════════════════════════════════════════
        //  DETAIL PANEL
        // ════════════════════════════════════════════════════════════════════

        /**
         * Populate /selectedPlan and show the detail panel.
         * Converts monthlyPlan flat object into a one-row array for the table.
         * @param {object} oPlan
         */
        _openDetailPanel: function (oPlan) {
            var oModel = this.getView().getModel();

            // Build flat row for the monthly table
            var mp = oPlan.monthlyPlan;
            var qt = oPlan.quarterlyTotals;
            var oMonthlyRow = {
                jan: mp.jan, feb: mp.feb, mar: mp.mar, q1: qt.q1, q1State: qt.q1State,
                apr: mp.apr, may: mp.may, jun: mp.jun, q2: qt.q2, q2State: qt.q2State,
                jul: mp.jul, aug: mp.aug, sep: mp.sep, q3: qt.q3, q3State: qt.q3State,
                oct: mp.oct, nov: mp.nov, dec: mp.dec, q4: qt.q4, q4State: qt.q4State,
                annual: oPlan.annualTotal
            };

            // Clone plan so detail panel gets its own copy
            var oSelected = jQuery.extend(true, {}, oPlan);
            oSelected.monthlyRows = [oMonthlyRow];

            oModel.setProperty("/selectedPlan", oSelected);
            oModel.setProperty("/detailVisible", true);

            // Scroll detail panel into view
            var oPanel = this.byId("detailPanel");
            if (oPanel && oPanel.getDomRef()) {
                oPanel.getDomRef().scrollIntoView({ behavior: "smooth", block: "start" });
            }
        },

        // ════════════════════════════════════════════════════════════════════
        //  HEADER TOOLBAR ACTIONS
        // ════════════════════════════════════════════════════════════════════

        onExport: function () {
            MessageToast.show("Export to Excel – connect to sap.ui.export.Spreadsheet in CAPM.");
        },

        onSearchPress: function () {
            var oTable = this.byId("plansTable");
            var oBinding = oTable.getBinding("rows");
            MessageToast.show("Total visible plans: " + oBinding.getLength());
        },

        onToggleFullScreen: function () {
            var oDynamicPage = this.byId("dynamicPage");
            if (oDynamicPage) {
                oDynamicPage.setHeaderExpanded(!oDynamicPage.getHeaderExpanded());
            }
        },

        onColumnSettings: function () {
            MessageToast.show("Column settings – use sap.m.p13n.Engine for column personalization.");
        },

        onRefresh: function () {
            var oModel = this.getView().getModel();
            oModel.setProperty("/busy", true);
            setTimeout(function () {
                oModel.setProperty("/busy", false);
                MessageToast.show("Data refreshed.");
            }, 800);
        },

        onRowSelectionChange: function () {
            // Row selection change – can be used for bulk-action button states
        },

        // ════════════════════════════════════════════════════════════════════
        //  PRIVATE HELPERS
        // ════════════════════════════════════════════════════════════════════

        /**
         * Show approve confirmation and set status.
         */
        _confirmApprove: function (sPlanId, sCustomer, sPath) {
            MessageBox.confirm(
                "Approve the annual plan for '" + sCustomer + "'?\nThis will be reflected in the customer portal and sent to Corporate.",
                {
                    title: "Approve Plan",
                    icon: MessageBox.Icon.SUCCESS,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            this._setStatus(sPath, STATUS.APPROVED, "Approved", "Success");

                            // Sync detail panel if same plan open
                            var oModel = this.getView().getModel();
                            var oSel   = oModel.getProperty("/selectedPlan");
                            if (oSel && oSel.planId === sPlanId) {
                                oModel.setProperty("/selectedPlan/status", STATUS.APPROVED);
                                oModel.setProperty("/selectedPlan/statusText", "Approved");
                                oModel.setProperty("/selectedPlan/statusState", "Success");
                            }
                            this._updateSummaryCount();
                            MessageToast.show("Plan approved for " + sCustomer + ".");
                        }
                    }.bind(this)
                }
            );
        },

        /**
         * Set status fields on a plan at the given model path.
         */
        _setStatus: function (sPath, sStatus, sStatusText, sStatusState) {
            var oModel = this.getView().getModel();
            oModel.setProperty(sPath + "/status",      sStatus);
            oModel.setProperty(sPath + "/statusText",  sStatusText);
            oModel.setProperty(sPath + "/statusState", sStatusState);
        },

        /**
         * Return the JSON model path for a given planId.
         * @returns {string} e.g. "/plans/0"
         */
        _getPathForPlanId: function (sPlanId) {
            var oModel = this.getView().getModel();
            var aPlans = oModel.getProperty("/plans");
            for (var i = 0; i < aPlans.length; i++) {
                if (aPlans[i].planId === sPlanId) return "/plans/" + i;
            }
            return "";
        },

        /**
         * Get selected rows from the plans table.
         * @returns {Array<{plan, path}>}
         */
        _getSelectedPlans: function () {
            var oTable  = this.byId("plansTable");
            var aIdxs   = oTable.getSelectedIndices();
            var oModel  = this.getView().getModel();
            var aPlans  = oModel.getProperty("/plans");
            return aIdxs.map(function (i) {
                return { plan: aPlans[i], path: "/plans/" + i };
            });
        },

        /**
         * Recalculate quarterly totals and states for the edit dialog model.
         * Mutates the passed data object directly.
         * @param {object} oData - edit model data
         */
        _recalcEditTotals: function (oData) {
            var mp     = oData.monthlyPlan;
            var limits = oData.quarterlyLimits;
            var aacq   = oData.aacq;

            var q1 = (mp.jan || 0) + (mp.feb || 0) + (mp.mar || 0);
            var q2 = (mp.apr || 0) + (mp.may || 0) + (mp.jun || 0);
            var q3 = (mp.jul || 0) + (mp.aug || 0) + (mp.sep || 0);
            var q4 = (mp.oct || 0) + (mp.nov || 0) + (mp.dec || 0);
            var total = q1 + q2 + q3 + q4;

            var q1Pct = aacq ? Math.round((q1 / aacq) * 100) : 0;
            var q2Pct = aacq ? Math.round((q2 / aacq) * 100) : 0;
            var q3Pct = aacq ? Math.round((q3 / aacq) * 100) : 0;
            var q4Pct = aacq ? Math.round((q4 / aacq) * 100) : 0;

            oData.q1Total = q1; oData.q1Pct = q1Pct; oData.q1State = this._getQtrState(q1Pct, limits.q1Limit);
            oData.q2Total = q2; oData.q2Pct = q2Pct; oData.q2State = this._getQtrState(q2Pct, limits.q2Limit);
            oData.q3Total = q3; oData.q3Pct = q3Pct; oData.q3State = this._getQtrState(q3Pct, limits.q3Limit);
            oData.q4Total = q4; oData.q4Pct = q4Pct; oData.q4State = this._getQtrState(q4Pct, limits.q4Limit);
            oData.editAnnualTotal = total;
        },

        /**
         * Determine ObjectStatus state based on % vs limit.
         * @param {number} pct   - actual percentage
         * @param {number} limit - allowed limit %
         * @returns {string} "Success" | "Warning" | "Error"
         */
        _getQtrState: function (pct, limit) {
            if (pct > limit)           return "Error";
            if (pct >= limit - 2)      return "Warning";   // within 2% of limit = amber
            return "Success";
        },

        /**
         * Recount plan statuses and update the summary info strip.
         */
        _updateSummaryCount: function () {
            var oModel = this.getView().getModel();
            var aPlans = oModel.getProperty("/plans");
            var pending  = 0, approved = 0, rejected = 0;
            aPlans.forEach(function (p) {
                if (p.status === STATUS.PENDING || p.status === STATUS.UNDER_REVIEW) pending++;
                else if (p.status === STATUS.APPROVED) approved++;
                else if (p.status === STATUS.REJECTED) rejected++;
            });
            oModel.setProperty("/summaryInfo/pending",  pending);
            oModel.setProperty("/summaryInfo/approved", approved);
            oModel.setProperty("/summaryInfo/rejected", rejected);
        }

    });
});
