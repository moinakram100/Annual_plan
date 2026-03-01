sap.ui.define([
    "sap/ui/core/mvc/Controller"
], (Controller) => {
    "use strict";

    return Controller.extend("com.ingenx.annualplan.controller.Main", {
        onInit() {
        },

        onPressQuarterlyPercentageTile : function(){
            const tile = this.getOwnerComponent().getRouter();
            tile.navTo("onRouteQuarterlyPercentage");
        },
        onPressAnnualPlanTile : function(){
            const tile = this.getOwnerComponent().getRouter();
            tile.navTo("onRouteAnnualPlan");
        },
        onPressZonalReviewTile : function(){
            const tile = this.getOwnerComponent().getRouter();
            tile.navTo("onRouteZonalReview");
        },
        onPressDashboardTile : function(){
            const tile = this.getOwnerComponent().getRouter();
            tile.navTo("onRouteDashboard");
        },
        onPressReductionTile : function(){
            const tile = this.getOwnerComponent().getRouter();
            tile.navTo("onRouteReduction");
        },
        onPressApprovalTile : function(){
            const tile = this.getOwnerComponent().getRouter();
            tile.navTo("onRouteApproval");
        }
    });
});