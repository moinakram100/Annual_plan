sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "com/ingenx/annualplan/model/models"
], function (UIComponent, JSONModel, models) {
    "use strict";

    return UIComponent.extend("com.ingenx.annualplan.Component", {

        metadata: {
            manifest: "json",
            interfaces: [
                "sap.ui.core.IAsyncContentCreation"
            ]
        },

        init: function () {

            // call parent init
            UIComponent.prototype.init.apply(this, arguments);

            // device model
            this.setModel(models.createDeviceModel(), "device");

            // global app state model
            var oAppState = new JSONModel({
                reductionPlan: null,
                approvalData: null
            });

            this.setModel(oAppState, "appState");

            // initialize router
            this.getRouter().initialize();
        }

    });
});