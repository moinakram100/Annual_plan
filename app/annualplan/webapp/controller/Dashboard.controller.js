
/**
 * CorporateDashboard.controller.js
 *
 * Controller for Screen 4 – Corporate Dashboard & Validation
 *
 * Business Rules (from FS):
 *   Rule 1  – Material only: aggregate all customers for that material
 *   Rule 2  – Material + Sales Office: aggregate within the zone
 *   Universal Rule – Any combination of Material / Sales Office /
 *                    Customer / Industry filters the dataset and
 *                    recalculates cumulative KPIs
 *
 *   Color Coding:
 *     Error   (Red)    → quarterly % exceeded
 *     Warning (Amber)  → within 2% of limit (near-threshold)
 *     Success (Green)  → compliant
 *
 * App: iGMS Annual Planning | Module: Corporate Dashboard
 * User Role: Corporate Team
 */
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/ui/core/Fragment"
], function (
    Controller,
    JSONModel,
    Filter,
    FilterOperator,
    Sorter,
    MessageBox,
    MessageToast,
    Fragment
) {
    "use strict";

    // ── Map: salesOffice filter key → partial text match in data ──────────────
    var ZONE_MAP = {
        NORTH: "North Zone",
        WEST:  "West Zone",
        SOUTH: "South Zone",
        EAST:  "East Zone"
    };

    // ── Map: industry filter key → display text in data ──────────────────────
    var INDUSTRY_MAP = {
        POWER:      "Power",
        FERTILIZER: "Fertilizer",
        INDUSTRIAL: "Industrial",
        TEXTILE:    "Textile",
        CHEMICAL:   "Chemical",
        REFINERY:   "Refinery"
    };

    return Controller.extend("com.ingenx.annualplan.controller.Dashboard", {

        // ════════════════════════════════════════════════════════════════════
        //  LIFECYCLE
        // ════════════════════════════════════════════════════════════════════

        onInit: function () {
            // Load dedicated dashboard model
            var oModel = new JSONModel(
                sap.ui.require.toUrl("com/ingenx/annualplan/model/dashboardData.json")
            );
            this.getView().setModel(oModel, "dash");

            // Lazy-loaded dialog references
            this._oLegendDialog    = null;
            this._oDrillDialog     = null;
        },

        // ════════════════════════════════════════════════════════════════════
        //  FILTER BAR
        // ════════════════════════════════════════════════════════════════════

        /**
         * GO – Apply filters, compute filtered rows, recalculate KPIs.
         * Implements Universal Rule: any combination of the 4 filter fields.
         */
        onApplyFilter: function () {
            var oModel   = this.getView().getModel("dash");
            var oFilters = oModel.getProperty("/filters");
            var aAllRows = oModel.getProperty("/planRows");

            oModel.setProperty("/ui/busy", true);

            // ── Filter ────────────────────────────────────────────────────
            var aFiltered = aAllRows.filter(function (oRow) {
                // Sales Office filter
                if (oFilters.salesOffice) {
                    var sZoneText = ZONE_MAP[oFilters.salesOffice] || oFilters.salesOffice;
                    if (oRow.salesOffice.indexOf(sZoneText) === -1) return false;
                }
                // Material filter
                if (oFilters.material && oRow.material !== oFilters.material) return false;
                // Customer filter
                if (oFilters.customer && oRow.customerId !== oFilters.customer) return false;
                // Industry filter
                if (oFilters.industry) {
                    var sIndText = INDUSTRY_MAP[oFilters.industry] || oFilters.industry;
                    if (oRow.industry !== sIndText) return false;
                }
                return true;
            });

            // ── Recalculate KPIs ──────────────────────────────────────────
            var oKPI = this._calcKPIs(aFiltered, oModel.getProperty("/quarterlyLimits"));

            oModel.setProperty("/filteredRows",  aFiltered);
            oModel.setProperty("/kpiSummary",    oKPI);
            oModel.setProperty("/ui/dataLoaded", true);
            oModel.setProperty("/ui/busy",       false);
            oModel.setProperty("/ui/lastRefreshed", this._nowString());

            MessageToast.show(
                aFiltered.length + " plan(s) loaded. " +
                oKPI.violatingPlans + " violation(s) detected."
            );
        },

        /**
         * CLEAR – Reset all filters and hide data.
         */
        onClearFilter: function () {
            var oModel = this.getView().getModel("dash");
            oModel.setProperty("/filters", { salesOffice: "", material: "", customer: "", industry: "" });
            oModel.setProperty("/filteredRows",  []);
            oModel.setProperty("/ui/dataLoaded", false);
            MessageToast.show("Filters cleared.");
        },

        // ════════════════════════════════════════════════════════════════════
        //  TOOLBAR ACTIONS
        // ════════════════════════════════════════════════════════════════════

        onRefresh: function () {
            var oModel = this.getView().getModel("dash");
            if (!oModel.getProperty("/ui/dataLoaded")) {
                MessageToast.show("Apply filters and click Go to load data.");
                return;
            }
            oModel.setProperty("/ui/busy", true);
            setTimeout(function () {
                // Re-run filter with current selections
                this.onApplyFilter();
            }.bind(this), 600);
        },

        onExport: function () {
            MessageToast.show("Export – connect to sap.ui.export.Spreadsheet in CAPM build.");
        },

        onToggleHeader: function () {
            var oPage = this.byId("dashPage");
            if (oPage) oPage.setHeaderExpanded(!oPage.getHeaderExpanded());
        },

        onKpiTilePress: function () {
            // Tile press – could drill into chart view in future
        },

        // ════════════════════════════════════════════════════════════════════
        //  GROUP BY
        // ════════════════════════════════════════════════════════════════════

        /**
         * Group the table rows by the selected property.
         * Uses sap.ui.model.Sorter on the table binding.
         */
        onGroupByChange: function (oEvent) {
            var sKey    = oEvent.getSource().getSelectedKey();
            var oTable  = this.byId("dashTable");
            var oBinding = oTable.getBinding("rows");
            if (!oBinding) return;

            if (!sKey) {
                oBinding.sort([]);
                MessageToast.show("Grouping removed.");
                return;
            }

            var oSorter = new Sorter(sKey, false, function (oContext) {
                return {
                    key:  oContext.getProperty(sKey),
                    text: oContext.getProperty(sKey)
                };
            });
            oBinding.sort([oSorter]);
            MessageToast.show("Grouped by: " + sKey);
        },

        // ════════════════════════════════════════════════════════════════════
        //  CUSTOMER DRILL-DOWN
        // ════════════════════════════════════════════════════════════════════

        /**
         * Click on customer name → open drill-down dialog with full plan detail.
         */
        onCustomerDrillDown: function (oEvent) {
            var oContext = oEvent.getSource().getBindingContext("dash");
            var oRow     = oContext.getObject();

            // Build drill model with a one-element monthlyRow array for the table
            var oDrillData = jQuery.extend(true, {}, oRow);
            oDrillData.monthlyRow = [{
                jan: oRow.jan, feb: oRow.feb, mar: oRow.mar,
                q1: oRow.q1,   q1State: oRow.q1State,
                apr: oRow.apr, may: oRow.may, jun: oRow.jun,
                q2: oRow.q2,   q2State: oRow.q2State,
                jul: oRow.jul, aug: oRow.aug, sep: oRow.sep,
                q3: oRow.q3,   q3State: oRow.q3State,
                oct: oRow.oct, nov: oRow.nov, dec: oRow.dec,
                q4: oRow.q4,   q4State: oRow.q4State,
                annual: oRow.annual,
                janState: oRow.janState, febState: oRow.febState, marState: oRow.marState,
                aprState: oRow.aprState, mayState: oRow.mayState, junState: oRow.junState,
                julState: oRow.julState, augState: oRow.augState, sepState: oRow.sepState,
                octState: oRow.octState, novState: oRow.novState, decState: oRow.decState
            }];

            var oDrillModel = new JSONModel(oDrillData);

            if (!this._oDrillDialog) {
                Fragment.load({
                    id:         this.getView().getId(),
                    name:       "com.ingenx.annualplan.fragments.CustomerDrillDown",
                    controller: this
                }).then(function (oDialog) {
                    this._oDrillDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.setModel(oDrillModel, "drill");
                    oDialog.open();
                }.bind(this));
            } else {
                this._oDrillDialog.setModel(oDrillModel, "drill");
                this._oDrillDialog.open();
            }
        },

        onCloseDrillDown: function () {
            if (this._oDrillDialog) this._oDrillDialog.close();
        },

        // ════════════════════════════════════════════════════════════════════
        //  LEGEND DIALOG
        // ════════════════════════════════════════════════════════════════════

        onShowLegend: function () {
            if (!this._oLegendDialog) {
                Fragment.load({
                    id:         this.getView().getId(),
                    name:       "com.ingenx.annualplan.fragments.LegendDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oLegendDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this._oLegendDialog.open();
            }
        },

        onPressReductionBtn: function (oEvent) {
            var oRowData = oEvent.getSource().getBindingContext("dash").getObject();
            this.getOwnerComponent().getRouter().navTo("onRouteReduction", {
                material    : oRowData.material,
                salesOffice : oRowData.salesOffice,
                customer    : oRowData.customerId,
                contract    : oRowData.contract,
                industry    : oRowData.industry
            });
        },
        onPressApprovalBtn: function (oEvent) {
            var oRowData = oEvent.getSource().getBindingContext("dash").getObject();
            this.getOwnerComponent().getRouter().navTo("onRouteApproval", {
                material    : oRowData.material,
                salesOffice : oRowData.salesOffice,
                customer    : oRowData.customerId,
                contract    : oRowData.contract,
                industry    : oRowData.industry
            });
        },

        onCloseLegend: function () {
            if (this._oLegendDialog) this._oLegendDialog.close();
        },

        // ════════════════════════════════════════════════════════════════════
        //  PRIVATE HELPERS
        // ════════════════════════════════════════════════════════════════════

        /**
         * Calculate cumulative KPI summary from the filtered plan rows.
         * Implements the FS Universal Rule:
         *   - Cumulative AACQ
         *   - Cumulative Q1–Q4 totals and % vs limits
         *   - Violation / compliant counts
         *
         * @param  {object[]} aRows          - filtered plan rows
         * @param  {object}   oLimits        - { q1Limit, q2Limit, q3Limit, q4Limit }
         * @returns {object}  KPI summary object
         */
        _calcKPIs: function (aRows, oLimits) {
            var cumAACQ = 0, cumQ1 = 0, cumQ2 = 0, cumQ3 = 0, cumQ4 = 0;
            var violating = 0, compliant = 0;

            aRows.forEach(function (r) {
                cumAACQ += (r.aacq  || 0);
                cumQ1   += (r.q1    || 0);
                cumQ2   += (r.q2    || 0);
                cumQ3   += (r.q3    || 0);
                cumQ4   += (r.q4    || 0);

                // A plan is "violating" if any quarterly total exceeds its limit
                var bViolating = (r.q1State === "Error" || r.q2State === "Error" ||
                                  r.q3State === "Error" || r.q4State === "Error");
                if (bViolating) violating++; else compliant++;
            });

            // Calculate cumulative percentages vs total AACQ
            var q1Pct = cumAACQ ? parseFloat(((cumQ1 / cumAACQ) * 100).toFixed(1)) : 0;
            var q2Pct = cumAACQ ? parseFloat(((cumQ2 / cumAACQ) * 100).toFixed(1)) : 0;
            var q3Pct = cumAACQ ? parseFloat(((cumQ3 / cumAACQ) * 100).toFixed(1)) : 0;
            var q4Pct = cumAACQ ? parseFloat(((cumQ4 / cumAACQ) * 100).toFixed(1)) : 0;

            return {
                cumulativeAACQ:    cumAACQ,
                cumulativeAACQUOM: "MMSCM",
                q1Total:  cumQ1,  q1Pct: q1Pct, q1State: this._getState(q1Pct, oLimits.q1Limit), q1Limit: oLimits.q1Limit,
                q2Total:  cumQ2,  q2Pct: q2Pct, q2State: this._getState(q2Pct, oLimits.q2Limit), q2Limit: oLimits.q2Limit,
                q3Total:  cumQ3,  q3Pct: q3Pct, q3State: this._getState(q3Pct, oLimits.q3Limit), q3Limit: oLimits.q3Limit,
                q4Total:  cumQ4,  q4Pct: q4Pct, q4State: this._getState(q4Pct, oLimits.q4Limit), q4Limit: oLimits.q4Limit,
                totalCustomers:  aRows.length,
                compliantPlans:  compliant,
                violatingPlans:  violating
            };
        },

        /**
         * Determine ObjectStatus / valueColor state from % vs limit.
         * Matches FS color coding rules:
         *   Red    → exceeded
         *   Amber  → within 2% of limit (near threshold)
         *   Green  → compliant
         *
         * @param  {number} pct   - actual percentage
         * @param  {number} limit - configured quarterly limit %
         * @returns {string} "Error" | "Warning" | "Success"
         */
        _getState: function (pct, limit) {
            if (pct > limit)           return "Error";
            if (pct >= limit - 2)      return "Warning";
            return "Success";
        },

        /**
         * Format current timestamp as a readable string.
         * @returns {string} e.g. "28 Feb 2025, 09:30 AM"
         */
        _nowString: function () {
            var d      = new Date();
            var months = ["Jan","Feb","Mar","Apr","May","Jun",
                          "Jul","Aug","Sep","Oct","Nov","Dec"];
            var hh = d.getHours(), mm = d.getMinutes();
            var ampm = hh >= 12 ? "PM" : "AM";
            hh = hh % 12 || 12;
            mm = mm < 10 ? "0" + mm : mm;
            return d.getDate() + " " + months[d.getMonth()] + " " + d.getFullYear() +
                   ", " + hh + ":" + mm + " " + ampm;
        }

    });
});
