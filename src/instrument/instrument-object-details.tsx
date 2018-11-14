import * as React from "react";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";

import { Panels, Panel } from "eez-studio-shared/ui/panel";
import { Loader } from "eez-studio-shared/ui/loader";
import {
    PropertyList,
    StaticProperty,
    TextInputProperty,
    BooleanProperty
} from "eez-studio-shared/ui/properties";
import { AlertDanger } from "eez-studio-shared/ui/alert";
import { Toolbar } from "eez-studio-shared/ui/toolbar";
import { ButtonAction } from "eez-studio-shared/ui/action";

import { ConnectionProperties } from "instrument/window/connection-dialog";
import { InstrumentObject } from "instrument/instrument-object";

import { ConnectionParameters } from "instrument/connection/interface";

@observer
class Properties extends React.Component<
    {
        instrument: InstrumentObject;
    },
    {}
> {
    render() {
        const extension = this.props.instrument.extension;
        if (!extension) {
            return null;
        }

        return (
            <PropertyList>
                <StaticProperty
                    name="Instrument"
                    value={extension!.displayName || extension!.name}
                />
                <TextInputProperty
                    name="Label"
                    value={this.props.instrument.label || ""}
                    onChange={value => this.props.instrument.setLabel(value)}
                />
                <StaticProperty name="IDN" value={this.props.instrument.idn || "Not found!"} />
                <BooleanProperty
                    name="Auto connect"
                    value={this.props.instrument.autoConnect}
                    onChange={value => this.props.instrument.setAutoConnect(value)}
                />
            </PropertyList>
        );
    }
}

@observer
class Connection extends React.Component<{
    instrument: InstrumentObject;
}> {
    connectionParameters: ConnectionParameters | null;

    @bind
    dismissError() {
        this.props.instrument.connection.dismissError();
    }

    render() {
        let { instrument } = this.props;

        let connection = this.props.instrument.connection;

        let info;
        let error;
        let connectionParameters;
        let button;

        if (connection) {
            if (connection.isIdle) {
                error = connection.error && (
                    <AlertDanger onDismiss={this.dismissError}>{connection.error}</AlertDanger>
                );

                connectionParameters = (
                    <ConnectionProperties
                        connectionParameters={instrument.getConnectionParameters([
                            instrument.lastConnection,
                            this.connectionParameters,
                            instrument.defaultConnectionParameters
                        ])}
                        onConnectionParametersChanged={(
                            connectionParameters: ConnectionParameters
                        ) => {
                            this.connectionParameters = connectionParameters;
                        }}
                        availableConnections={this.props.instrument.availableConnections}
                        serialBaudRates={this.props.instrument.serialBaudRates}
                    />
                );

                button = (
                    <button
                        className="btn btn-success"
                        onClick={() => {
                            if (this.connectionParameters) {
                                this.props.instrument.setConnectionParameters(
                                    this.connectionParameters
                                );
                                this.connectionParameters = null;
                            } else if (!instrument.lastConnection) {
                                this.props.instrument.setConnectionParameters(
                                    instrument.defaultConnectionParameters
                                );
                            }
                            connection!.connect();
                        }}
                    >
                        Connect
                    </button>
                );
            } else {
                if (connection.isTransitionState) {
                    info = <Loader className="mb-2" />;
                }

                connectionParameters = instrument.connectionParametersDetails;

                if (connection.isConnected) {
                    button = (
                        <button className="btn btn-danger" onClick={() => connection!.disconnect()}>
                            Disconnect
                        </button>
                    );
                } else {
                    button = (
                        <button className="btn btn-danger" onClick={() => connection!.disconnect()}>
                            Abort
                        </button>
                    );
                }
            }
        }

        return (
            <div>
                <div>
                    {info}
                    {error}
                    {connectionParameters}
                    <div className="text-left">{button}</div>
                </div>
            </div>
        );
    }
}

export class InstrumentDetails extends React.Component<{ instrument: InstrumentObject }, {}> {
    @bind
    onOpenInTab() {
        this.props.instrument.openEditor("tab");
    }

    @bind
    onOpenInWindow() {
        this.props.instrument.openEditor("window");
    }

    @bind
    onDelete() {
        window.postMessage(
            {
                type: "delete-object",
                object: {
                    id: this.props.instrument.id,
                    type: "instrument"
                }
            },
            "*"
        );
    }

    render() {
        let { instrument } = this.props;
        return (
            <Panels>
                <Panel title="Actions">
                    <Toolbar>
                        <ButtonAction
                            text="Open in Tab"
                            title="Open instrument in new tab"
                            className="btn btn-default"
                            onClick={this.onOpenInTab}
                        />
                        <ButtonAction
                            text="Open in Window"
                            title="Open instrument in new window"
                            className="btn btn-default"
                            onClick={this.onOpenInWindow}
                        />
                        <ButtonAction
                            text="Delete"
                            title="Delete instrument"
                            className="btn btn-danger"
                            onClick={this.onDelete}
                        />
                    </Toolbar>
                </Panel>

                <Panel title="Properties">
                    <Properties instrument={instrument} />
                </Panel>

                <Panel title="Connection">
                    <Connection instrument={instrument} />
                </Panel>
            </Panels>
        );
    }
}
