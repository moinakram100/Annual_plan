
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment",
    "sap/ui/core/ValueState"
], function (
    Controller,
    JSONModel,
    MessageBox,
    MessageToast,
    Fragment,
    ValueState
) {
    "use strict";

    // Month field names in model
    var MONTHS = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];

    return Controller.extend("com.ingenx.annualplan.controller.AnnualPlan", {

        // ════════════════════════════════════════════════════════════════════
        //  LIFECYCLE
        // ════════════════════════════════════════════════════════════════════

        onInit: function () {
            var oModel = new JSONModel(
                sap.ui.require.toUrl("com/ingenx/annualplan/model/annualPlanData.json")
            );
            this.getView().setModel(oModel, "ap");

            // Snapshot for reset
            this._oOriginalPlan = null;
        },

        // ════════════════════════════════════════════════════════════════════
        //  CONTRACT SELECTION
        // ════════════════════════════════════════════════════════════════════

        /** Called when year or customer ID selection changes */
        onSelectionChange: function () {
            // Nothing yet – wait for "Load Contract"
        },

        /**
         * Load Contract button – finds the matching contract from the data
         * and populates the contract info panel and resets the plan grid.
         */
        onLoadContract: function () {
            var oModel          = this.getView().getModel("ap");
            var sContractNumber = oModel.getProperty("/contractSelection/contractNumber");

            if (!sContractNumber) {
                MessageBox.warning("Please select a Contract Number before loading.");
                return;
            }

            oModel.setProperty("/ui/busy", true);

            // ── In CAPM: OData read to fetch contract master data ─────────
            // var oODataModel = this.getOwnerComponent().getModel("mainService");
            // oODataModel.read("/Contracts('" + sContractNumber + "')", {
            //     success: this._onContractLoaded.bind(this),
            //     error:   this._onLoadError.bind(this)
            // });
            // ─────────────────────────────────────────────────────────────

            // JSON stub: find contract in local data
            setTimeout(function () {
                var aContracts = oModel.getProperty("/contracts");
                var oContract  = aContracts.find(function (c) {
                    return c.contractNumber === sContractNumber;
                });

                if (!oContract) {
                    oModel.setProperty("/ui/busy", false);
                    MessageBox.error("Contract '" + sContractNumber + "' not found or not active.");
                    return;
                }

                this._onContractLoaded(oContract);
            }.bind(this), 500);
        },

        /**
         * Populate screen after contract is loaded.
         * Calculates AACQ, resets plan, shows contract info panel.
         * @param {object} oContract - contract master data object
         */
        _onContractLoaded: function (oContract) {
            var oModel = this.getView().getModel("ap");

            // ── Recalculate AACQ from formula ─────────────────────────────
            // AACQ = ACQ + UpwardFlex(as amount) – DownwardFlex(as amount)
            //      + Make-Up Gas + Make-Good Gas
            // Note: Flex% is stored as % value; we apply it to ACQ
            var acq           = oContract.acq;
            var upwardAmt     = Math.round(acq * oContract.upwardFlex   / 100);
            var downwardAmt   = Math.round(acq * oContract.downwardFlex / 100);
            var calcAACQ      = acq + upwardAmt - downwardAmt
                                + oContract.makeUpGas + oContract.makeGoodGas;

            // Use contract's stored AACQ (already calculated in master data)
            // Override with formula result for transparency
            var oContractCopy      = jQuery.extend(true, {}, oContract);
            oContractCopy.aacq     = oContract.aacq || calcAACQ;

            // S/D remaining
            var sdRemaining = oContractCopy.sdDaysAllowed - (oContractCopy.sdDaysUsed || 0);

            oModel.setProperty("/selectedContract",     oContractCopy);
            oModel.setProperty("/ui/contractSelected",  true);
            oModel.setProperty("/ui/busy",              false);
            oModel.setProperty("/ui/sdDaysRemaining",   sdRemaining);
            oModel.setProperty("/ui/planSubmitted",     false);
            oModel.setProperty("/ui/hasChanges",        false);
            oModel.setProperty("/ui/submitEnabled",     false);

            // Reset plan grid
            this._resetPlan();

            // Take snapshot for reset
            this._oOriginalPlan = jQuery.extend(true, {}, oModel.getProperty("/annualPlan"));

            MessageToast.show(
                "Contract loaded: " + oContractCopy.contractNumber +
                " · AACQ = " + oContractCopy.aacq + " " + oContractCopy.uom
            );
        },

        /** Clear everything and start fresh */
        onClearAll: function () {
            var oModel = this.getView().getModel("ap");
            if (oModel.getProperty("/ui/hasChanges")) {
                MessageBox.confirm("Clear all entries?", {
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            this._fullReset();
                        }
                    }.bind(this)
                });
            } else {
                this._fullReset();
            }
        },

        /** Customer value help stub */
        onCustomerVH: function () {
            MessageToast.show("Customer VH – connect to OData CustomerSet in CAPM.");
        },

        onContractChange: function () {
            // Reset panel when contract dropdown changes
            var oModel = this.getView().getModel("ap");
            oModel.setProperty("/ui/contractSelected", false);
        },

        // ════════════════════════════════════════════════════════════════════
        //  MONTHLY QUANTITY ENTRY  (core business logic)
        // ════════════════════════════════════════════════════════════════════

        /**
         * Called on every StepInput change (any month).
         * 1. Recalculates Q1–Q4 totals and annual total
         * 2. Computes each quarter as % of AACQ
         * 3. Validates vs corporate quarterly limits
         * 4. Sets ObjectStatus states (Success / Warning / Error)
         * 5. Enables/disables Submit button
         */
        onMonthChange: function () {
            var oModel    = this.getView().getModel("ap");
            var oPlan     = oModel.getProperty("/annualPlan");
            var oContract = oModel.getProperty("/selectedContract");
            var oLimits   = oModel.getProperty("/quarterlyLimits");

            if (!oContract) return;

            var aacq = oContract.aacq;

            // ── Recalculate quarterly totals ─────────────────────────────
            var q1 = (oPlan.jan || 0) + (oPlan.feb || 0) + (oPlan.mar || 0);
            var q2 = (oPlan.apr || 0) + (oPlan.may || 0) + (oPlan.jun || 0);
            var q3 = (oPlan.jul || 0) + (oPlan.aug || 0) + (oPlan.sep || 0);
            var q4 = (oPlan.oct || 0) + (oPlan.nov || 0) + (oPlan.dec || 0);
            var annual = q1 + q2 + q3 + q4;

            // ── Calculate % vs AACQ ──────────────────────────────────────
            var q1Pct = aacq ? parseFloat(((q1 / aacq) * 100).toFixed(1)) : 0;
            var q2Pct = aacq ? parseFloat(((q2 / aacq) * 100).toFixed(1)) : 0;
            var q3Pct = aacq ? parseFloat(((q3 / aacq) * 100).toFixed(1)) : 0;
            var q4Pct = aacq ? parseFloat(((q4 / aacq) * 100).toFixed(1)) : 0;

            // ── Determine ObjectStatus states (per FS colour rules) ───────
            // Error   = exceeded limit
            // Warning = within 2% of limit (near threshold)
            // Success = compliant
            var q1State = this._getQtrState(q1Pct, oLimits.q1Limit);
            var q2State = this._getQtrState(q2Pct, oLimits.q2Limit);
            var q3State = this._getQtrState(q3Pct, oLimits.q3Limit);
            var q4State = this._getQtrState(q4Pct, oLimits.q4Limit);

            // Warning flags (for the MessageStrip visibility binding)
            var q1Warn = q1State === "Error" || q1State === "Warning";
            var q2Warn = q2State === "Error" || q2State === "Warning";
            var q3Warn = q3State === "Error" || q3State === "Warning";
            var q4Warn = q4State === "Error" || q4State === "Warning";

            // Annual match state
            var bAACQMatch   = (annual === aacq);
            var sAnnualState = bAACQMatch ? "Success" : (annual > 0 ? "Error" : "None");

            // ── Write back to model ──────────────────────────────────────
            oModel.setProperty("/annualPlan/q1Total",  q1);
            oModel.setProperty("/annualPlan/q1Pct",    q1Pct);
            oModel.setProperty("/annualPlan/q1State",  q1State);
            oModel.setProperty("/annualPlan/q1Warning",q1Warn);
            oModel.setProperty("/annualPlan/q2Total",  q2);
            oModel.setProperty("/annualPlan/q2Pct",    q2Pct);
            oModel.setProperty("/annualPlan/q2State",  q2State);
            oModel.setProperty("/annualPlan/q2Warning",q2Warn);
            oModel.setProperty("/annualPlan/q3Total",  q3);
            oModel.setProperty("/annualPlan/q3Pct",    q3Pct);
            oModel.setProperty("/annualPlan/q3State",  q3State);
            oModel.setProperty("/annualPlan/q3Warning",q3Warn);
            oModel.setProperty("/annualPlan/q4Total",  q4);
            oModel.setProperty("/annualPlan/q4Pct",    q4Pct);
            oModel.setProperty("/annualPlan/q4State",  q4State);
            oModel.setProperty("/annualPlan/q4Warning",q4Warn);
            oModel.setProperty("/annualPlan/annualTotal",  annual);
            oModel.setProperty("/annualPlan/annualState",  sAnnualState);
            oModel.setProperty("/annualPlan/aacqMatch",    bAACQMatch);

            // ── Enable submit only if: AACQ matched + no errors ──────────
            var bNoErrors = q1State !== "Error" && q2State !== "Error" &&
                            q3State !== "Error" && q4State !== "Error";
            oModel.setProperty("/ui/submitEnabled", bAACQMatch && bNoErrors);
            oModel.setProperty("/ui/hasChanges", annual > 0);

            // ── Show inline warning toast for immediate feedback ──────────
            if (q1Warn || q2Warn || q3Warn || q4Warn) {
                // Warning strip in view handles persistent display;
                // show a short toast only when first violation appears
            }
        },

        // ════════════════════════════════════════════════════════════════════
        //  SHUTDOWN / MAINTENANCE DAYS
        // ════════════════════════════════════════════════════════════════════

        /**
         * Add a new empty shutdown row to the table.
         * Subject to remaining S/D days allowance.
         */
        onAddShutdownRow: function () {
            var oModel      = this.getView().getModel("ap");
            var iRemaining  = oModel.getProperty("/ui/sdDaysRemaining");

            if (iRemaining <= 0) {
                MessageBox.warning(
                    "All shutdown days have been allocated (" +
                    oModel.getProperty("/selectedContract/sdDaysAllowed") +
                    " days used). Cannot add more shutdown periods."
                );
                return;
            }

            var aRows = oModel.getProperty("/shutdownRows") || [];
            aRows.push({
                id:        "SD-" + Date.now(),
                month:     "JAN",
                days:      1,
                dcq:       0,
                reason:    "",
                daysState: ValueState.None
            });
            oModel.setProperty("/shutdownRows", aRows);
            oModel.setProperty("/ui/hasChanges", true);
            this._recalcSDRemaining();
        },

        /**
         * Called on any shutdown row field change.
         * Recalculates remaining S/D days.
         */
        onShutdownChange: function () {
            this._recalcSDRemaining();
            var oModel = this.getView().getModel("ap");
            oModel.setProperty("/ui/hasChanges", true);
        },

        /**
         * Delete a shutdown row.
         */
        onDeleteShutdownRow: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("ap");
            var sPath    = oContext.getPath();
            var iIndex   = parseInt(sPath.split("/").pop(), 10);
            var oModel   = this.getView().getModel("ap");
            var aRows    = oModel.getProperty("/shutdownRows");
            aRows.splice(iIndex, 1);
            oModel.setProperty("/shutdownRows", aRows);
            this._recalcSDRemaining();
            oModel.setProperty("/ui/hasChanges", true);
        },

        /**
         * Sum all shutdown days rows and update sdDaysRemaining.
         * Also validates: no single row can exceed remaining days.
         */
        _recalcSDRemaining: function () {
            var oModel       = this.getView().getModel("ap");
            var aRows        = oModel.getProperty("/shutdownRows") || [];
            var iAllowed     = oModel.getProperty("/selectedContract/sdDaysAllowed") || 0;
            var iTotalUsed   = 0;

            aRows.forEach(function (r) {
                iTotalUsed += (parseInt(r.days) || 0);
            });

            var iRemaining = iAllowed - iTotalUsed;
            oModel.setProperty("/ui/sdDaysRemaining", Math.max(iRemaining, 0));

            // Flag rows where days exceed remaining
            aRows.forEach(function (r, i) {
                oModel.setProperty(
                    "/shutdownRows/" + i + "/daysState",
                    iTotalUsed > iAllowed ? ValueState.Error : ValueState.None
                );
            });
        },

        // ════════════════════════════════════════════════════════════════════
        //  SAVE DRAFT
        // ════════════════════════════════════════════════════════════════════

        onSaveDraft: function () {
            var oModel   = this.getView().getModel("ap");
            var oContract= oModel.getProperty("/selectedContract");
            var oPlan    = oModel.getProperty("/annualPlan");

            if (!oContract) return;

            oModel.setProperty("/ui/busy", true);

            // ── CAPM: OData CREATE/UPDATE to AnnualPlan entity ───────────
            // var oPayload = this._buildPayload(oContract, oPlan);
            // oODataModel.create("/AnnualPlans", oPayload, { success: ..., error: ... });
            // ─────────────────────────────────────────────────────────────

            setTimeout(function () {
                oModel.setProperty("/ui/busy",       false);
                oModel.setProperty("/ui/hasChanges", false);
                MessageToast.show("Draft saved for " + oContract.contractNumber + ".");
            }.bind(this), 400);
        },

        // ════════════════════════════════════════════════════════════════════
        //  SUBMIT PLAN
        // ════════════════════════════════════════════════════════════════════

        /**
         * Final validation and submit.
         * Per FS: submitted plan goes to Zonal Office for review.
         */
        onSubmitPlan: function () {
            var oModel    = this.getView().getModel("ap");
            var oContract = oModel.getProperty("/selectedContract");
            var oPlan     = oModel.getProperty("/annualPlan");
            var aSD       = oModel.getProperty("/shutdownRows") || [];

            // ── Pre-submit validation ─────────────────────────────────────
            var aErrors = this._validateBeforeSubmit(oContract, oPlan, aSD);
            if (aErrors.length > 0) {
                MessageBox.error(
                    "Please fix the following before submitting:\n\n" +
                    aErrors.map(function (e, i) { return (i + 1) + ". " + e; }).join("\n"),
                    { title: "Validation Failed" }
                );
                return;
            }

            // ── Warn about quarterly violations (non-blocking) ────────────
            var aWarnings = [];
            if (oPlan.q1State === "Error") aWarnings.push("Q1 (" + oPlan.q1Pct + "%) exceeds limit of " + oModel.getProperty("/quarterlyLimits/q1Limit") + "%");
            if (oPlan.q2State === "Error") aWarnings.push("Q2 (" + oPlan.q2Pct + "%) exceeds limit of " + oModel.getProperty("/quarterlyLimits/q2Limit") + "%");
            if (oPlan.q3State === "Error") aWarnings.push("Q3 (" + oPlan.q3Pct + "%) exceeds limit of " + oModel.getProperty("/quarterlyLimits/q3Limit") + "%");
            if (oPlan.q4State === "Error") aWarnings.push("Q4 (" + oPlan.q4Pct + "%) exceeds limit of " + oModel.getProperty("/quarterlyLimits/q4Limit") + "%");

            // Build confirm message
            var sMsg =
                "Submit Annual Plan for:\n" +
                "  Contract : " + oContract.contractNumber + "\n" +
                "  Customer : " + oContract.customerDesc   + "\n" +
                "  Material : " + oContract.material       + "\n" +
                "  AACQ     : " + oContract.aacq + " " + oContract.uom + "\n\n" +
                (aWarnings.length
                    ? "⚠ Warning – the following quarterly limits are exceeded:\n" +
                      aWarnings.map(function (w) { return "  • " + w; }).join("\n") +
                      "\n\nYou may still submit. The Zonal Office will review.\n\n"
                    : "") +
                "The plan will be sent to the Zonal Office for review and approval.\n" +
                "Proceed?";

            MessageBox.confirm(sMsg, {
                title:   "Confirm Submission",
                icon:    aWarnings.length ? MessageBox.Icon.WARNING : MessageBox.Icon.SUCCESS,
                actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._persistSubmit();
                    }
                }.bind(this)
            });
        },

        /**
         * Persist the submitted plan (CAPM OData action stub).
         */
        _persistSubmit: function () {
            var oModel = this.getView().getModel("ap");
            oModel.setProperty("/ui/busy", true);

            // ── CAPM: Call OData action "SubmitAnnualPlan" ────────────────
            // oODataModel.callFunction("/SubmitAnnualPlan", {
            //     method:  "POST",
            //     urlParameters: { PlanId: sPlanId },
            //     success: this._onSubmitSuccess.bind(this),
            //     error:   this._onSubmitError.bind(this)
            // });
            // ─────────────────────────────────────────────────────────────

            setTimeout(function () {
                oModel.setProperty("/ui/busy",         false);
                oModel.setProperty("/ui/planSubmitted",true);
                oModel.setProperty("/ui/hasChanges",   false);
                oModel.setProperty("/ui/submitEnabled",false);
                oModel.setProperty("/annualPlan/status","SUBMITTED");
                MessageToast.show("Plan submitted to Zonal Office for review.");
            }.bind(this), 800);
        },

        // ════════════════════════════════════════════════════════════════════
        //  RESET
        // ════════════════════════════════════════════════════════════════════

        onReset: function () {
            var oModel = this.getView().getModel("ap");
            MessageBox.confirm("Reset all monthly quantities to zero?", {
                title: "Reset Plan",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._resetPlan();
                        oModel.setProperty("/shutdownRows", []);
                        this._recalcSDRemaining();
                        MessageToast.show("Plan reset.");
                    }
                }.bind(this)
            });
        },

        // ════════════════════════════════════════════════════════════════════
        //  PRIVATE HELPERS
        // ════════════════════════════════════════════════════════════════════

        /**
         * Reset the annualPlan model section to all zeros / defaults.
         */
        _resetPlan: function () {
            var oModel = this.getView().getModel("ap");
            var oBlank = {
                planId: "", status: "DRAFT",
                jan:0, feb:0, mar:0, apr:0, may:0, jun:0,
                jul:0, aug:0, sep:0, oct:0, nov:0, dec:0,
                q1Total:0, q1Pct:0, q1State:"None", q1Warning:false,
                q2Total:0, q2Pct:0, q2State:"None", q2Warning:false,
                q3Total:0, q3Pct:0, q3State:"None", q3Warning:false,
                q4Total:0, q4Pct:0, q4State:"None", q4Warning:false,
                annualTotal:0, annualState:"None", aacqMatch:false
            };
            oModel.setProperty("/annualPlan",         oBlank);
            oModel.setProperty("/ui/hasChanges",      false);
            oModel.setProperty("/ui/submitEnabled",   false);
            oModel.setProperty("/ui/planSubmitted",   false);
        },

        /**
         * Full reset: clear contract selection too.
         */
        _fullReset: function () {
            var oModel = this.getView().getModel("ap");
            oModel.setProperty("/contractSelection/contractNumber", "");
            oModel.setProperty("/selectedContract",    null);
            oModel.setProperty("/ui/contractSelected", false);
            oModel.setProperty("/shutdownRows",        []);
            this._resetPlan();
            MessageToast.show("Cleared.");
        },

        /**
         * Determine ObjectStatus state for quarterly % vs limit.
         * Matches FS colour coding:
         *   Error   (Red)   → exceeded limit
         *   Warning (Amber) → within 2% of limit
         *   Success (Green) → compliant
         *   None            → no data yet (zero)
         *
         * @param  {number} pct   - actual %
         * @param  {number} limit - corporate limit %
         * @returns {string} "Error" | "Warning" | "Success" | "None"
         */
        _getQtrState: function (pct, limit) {
            if (pct === 0)        return "None";
            if (pct > limit)      return "Error";
            if (pct >= limit - 2) return "Warning";
            return "Success";
        },

        /**
         * Full validation pass before submit.
         * @param  {object}   oContract
         * @param  {object}   oPlan
         * @param  {object[]} aSD       - shutdown rows
         * @returns {string[]} error messages
         */
        _validateBeforeSubmit: function (oContract, oPlan, aSD) {
            var aErrors = [];

            // 1. All months must be > 0
            var aZero = [];
            MONTHS.forEach(function (m) {
                if (!(oPlan[m] > 0)) aZero.push(m.charAt(0).toUpperCase() + m.slice(1));
            });
            if (aZero.length > 0) {
                aErrors.push("Monthly quantities must be > 0 for: " + aZero.join(", "));
            }

            // 2. Annual total must equal AACQ
            if (oPlan.annualTotal !== oContract.aacq) {
                aErrors.push(
                    "Annual total (" + oPlan.annualTotal + ") must equal AACQ (" +
                    oContract.aacq + " " + oContract.uom + ")."
                );
            }

            // 3. Shutdown days must not exceed contract allowance
            var oModel   = this.getView().getModel("ap");
            var iAllowed = oContract.sdDaysAllowed;
            var iUsed    = aSD.reduce(function (s, r) { return s + (parseInt(r.days) || 0); }, 0);
            if (iUsed > iAllowed) {
                aErrors.push(
                    "Total shutdown days (" + iUsed + ") exceed contract allowance (" + iAllowed + " days)."
                );
            }

            // 4. Shutdown DCQ must be provided if days are entered
            aSD.forEach(function (r, i) {
                if (r.days > 0 && !(r.dcq > 0)) {
                    aErrors.push("Shutdown row " + (i + 1) + ": Applicable DCQ must be > 0 when days are entered.");
                }
            });

            return aErrors;
        },

        /**
         * Build OData payload for CAPM (reference stub).
         */
        _buildPayload: function (oContract, oPlan) {
            return {
                ContractNumber: oContract.contractNumber,
                CustomerId:     oContract.customerId,
                Material:       oContract.material,
                CalendarYear:   this.getView().getModel("ap").getProperty("/contractSelection/calendarYear"),
                AACQ:           oContract.aacq,
                Jan:  oPlan.jan, Feb: oPlan.feb, Mar: oPlan.mar,
                Apr:  oPlan.apr, May: oPlan.may, Jun: oPlan.jun,
                Jul:  oPlan.jul, Aug: oPlan.aug, Sep: oPlan.sep,
                Oct:  oPlan.oct, Nov: oPlan.nov, Dec: oPlan.dec,
                Q1Total: oPlan.q1Total, Q2Total: oPlan.q2Total,
                Q3Total: oPlan.q3Total, Q4Total: oPlan.q4Total,
                AnnualTotal: oPlan.annualTotal,
                Status: "SUBMITTED"
            };
        }

    });
});
