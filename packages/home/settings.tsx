import React from "react";
import { observable, computed, action, runInAction } from "mobx";
import { observer } from "mobx-react";
import { bind } from "bind-decorator";
import moment from "moment";
import classNames from "classnames";

const shell = require("electron").shell;
import { app, createEmptyFile } from "eez-studio-shared/util";
import { stringCompare } from "eez-studio-shared/string";
import { getDbPath, setDbPath } from "eez-studio-shared/db";
import {
    LOCALES,
    getLocale,
    setLocale,
    DATE_FORMATS,
    getDateFormat,
    setDateFormat,
    TIME_FORMATS,
    getTimeFormat,
    setTimeFormat
} from "eez-studio-shared/i10n";
import { formatBytes } from "eez-studio-shared/formatBytes";
import { addAlphaToColor } from "eez-studio-shared/color";

import { showDialog, Dialog } from "eez-studio-ui/dialog";
import { Loader } from "eez-studio-ui/loader";

import styled from "eez-studio-ui/styled-components";
import { PropertyList, FileInputProperty, SelectProperty } from "eez-studio-ui/properties";
import * as notification from "eez-studio-ui/notification";
import { PanelHeader } from "eez-studio-ui/header-with-body";

import dbVacuum from "db-services/vacuum";

////////////////////////////////////////////////////////////////////////////////

// after this period we should advise user to compact database
const CONF_DATABASE_COMPACT_ADVISE_PERIOD = 30 * 24 * 60 * 60 * 1000; // 30 days

const TIME_OF_LAST_DATABASE_COMPACT_OPERATION_ITEM_NAME =
    "/home/settings/timeOfLastDatabaseCompactOperation";

export const COMPACT_DATABASE_MESSAGE = "It is advisable to compact database every 30 days.";

////////////////////////////////////////////////////////////////////////////////

class SettingsController {
    activeDatabasePath = getDbPath();
    activetLocale = getLocale();
    activeDateFormat = getDateFormat();
    activeTimeFormat = getTimeFormat();

    @observable
    databasePath: string = getDbPath();

    @observable
    locale: string = getLocale();

    @observable
    dateFormat: string = getDateFormat();

    @observable
    timeFormat: string = getTimeFormat();

    @observable
    databaseSize: number;

    @observable
    timeOfLastDatabaseCompactOperation: Date;

    @observable
    _isCompactDatabaseAdvisable: boolean;

    constructor() {
        var fs = require("fs");

        this.databaseSize = fs.statSync(this.activeDatabasePath).size;

        this.updateTimeOfLastDatabaseCompact();

        setInterval(this.updateTimeOfLastDatabaseCompact, 60 * 1000);
    }

    @action.bound
    updateTimeOfLastDatabaseCompact() {
        let timeOfLastDatabaseCompactOperationStr = localStorage.getItem(
            TIME_OF_LAST_DATABASE_COMPACT_OPERATION_ITEM_NAME
        );

        if (timeOfLastDatabaseCompactOperationStr) {
            this.timeOfLastDatabaseCompactOperation = new Date(
                parseInt(timeOfLastDatabaseCompactOperationStr)
            );
        } else {
            this.timeOfLastDatabaseCompactOperation = new Date();
            localStorage.setItem(
                TIME_OF_LAST_DATABASE_COMPACT_OPERATION_ITEM_NAME,
                this.timeOfLastDatabaseCompactOperation.getTime().toString()
            );
        }

        this._isCompactDatabaseAdvisable =
            new Date().getTime() - this.timeOfLastDatabaseCompactOperation.getTime() >
            CONF_DATABASE_COMPACT_ADVISE_PERIOD;
    }

    @computed
    get isCompactDatabaseAdvisable() {
        return this.databasePath === this.activeDatabasePath && this._isCompactDatabaseAdvisable;
    }

    @computed
    get restartRequired() {
        return (
            this.databasePath !== this.activeDatabasePath ||
            this.locale !== this.activetLocale ||
            this.dateFormat !== this.activeDateFormat ||
            this.timeFormat !== this.activeTimeFormat
        );
    }

    @action.bound
    onDatabasePathChange(databasePath: string) {
        this.databasePath = databasePath;
        setDbPath(this.databasePath);
    }

    @action.bound
    onLocaleChange(value: string) {
        this.locale = value;
        setLocale(value);
    }

    @action.bound
    onDateFormatChanged(value: string) {
        this.dateFormat = value;
        setDateFormat(value);
    }

    @action.bound
    onTimeFormatChanged(value: string) {
        this.timeFormat = value;
        setTimeFormat(value);
    }

    @bind
    createNewDatabase() {
        EEZStudio.electron.remote.dialog.showSaveDialog(
            EEZStudio.electron.remote.getCurrentWindow(),
            {},
            (filePath: any) => {
                if (filePath) {
                    try {
                        createEmptyFile(filePath);
                        notification.success(`New database created`);
                    } catch (error) {
                        notification.error(error.toString());
                    }
                }
            }
        );
    }

    @bind
    showDatabasePathInFolder() {
        shell.showItemInFolder(this.databasePath);
    }

    @bind
    restart() {
        app.relaunch();
        app.exit();
    }

    compactDatabase() {
        showDialog(<CompactDatabaseDialog />);
    }
}

export const settingsController = new SettingsController();

////////////////////////////////////////////////////////////////////////////////

const CompactDatabaseDialogTable = styled.table`
    & td {
        padding: 5px;
    }
`;

@observer
class CompactDatabaseDialog extends React.Component<{}, {}> {
    @observable
    sizeBefore: number;

    @observable
    sizeAfter: number | undefined;

    @observable
    sizeReduced: number | undefined;

    constructor(props: any) {
        super(props);

        var fs = require("fs");
        this.sizeBefore = fs.statSync(settingsController.activeDatabasePath).size;
    }

    async componentDidMount() {
        try {
            await dbVacuum();

            localStorage.setItem(
                TIME_OF_LAST_DATABASE_COMPACT_OPERATION_ITEM_NAME,
                new Date().getTime().toString()
            );
            settingsController.updateTimeOfLastDatabaseCompact();

            runInAction(() => {
                var fs = require("fs");
                this.sizeAfter = fs.statSync(settingsController.activeDatabasePath).size;

                settingsController.databaseSize = this.sizeAfter!;

                this.sizeReduced = (100 * (this.sizeBefore - this.sizeAfter!)) / this.sizeBefore;
                if (this.sizeReduced < 1) {
                    this.sizeReduced = Math.round(100 * this.sizeReduced) / 100;
                } else if (this.sizeReduced < 10) {
                    this.sizeReduced = Math.round(10 * this.sizeReduced) / 10;
                } else {
                    this.sizeReduced = Math.round(this.sizeReduced);
                }
            });
        } catch (err) {
            notification.error(err);
        }
    }

    render() {
        return (
            <Dialog
                open={true}
                title="Compacting Database"
                size="small"
                cancelButtonText="Close"
                cancelDisabled={this.sizeAfter === undefined}
            >
                <CompactDatabaseDialogTable>
                    <tbody>
                        <tr>
                            <td>Size before</td>
                            <td>{formatBytes(this.sizeBefore)}</td>
                        </tr>
                        <tr>
                            <td>Size after</td>
                            <td>
                                {this.sizeAfter !== undefined ? (
                                    formatBytes(this.sizeAfter)
                                ) : (
                                    <Loader style={{ margin: 0 }} />
                                )}
                            </td>
                        </tr>
                        {this.sizeReduced !== undefined && (
                            <tr>
                                <td>Size reduced by </td>
                                <td>
                                    {formatBytes(this.sizeBefore - this.sizeAfter!)} or{" "}
                                    {this.sizeReduced}%
                                </td>
                            </tr>
                        )}
                    </tbody>
                </CompactDatabaseDialogTable>
            </Dialog>
        );
    }
}

////////////////////////////////////////////////////////////////////////////////

const HomeSettingsBody = styled.div`
    padding: 50px 0;
    margin: auto;
    max-width: 640px;
`;

const HomeSettingsBar = styled(PanelHeader)`
    position: absolute;
    bottom: 0;
    width: 100%;
    text-align: right;
    border-bottom-width: 0;
    border-top-width: 1px;
`;

const DatabaseCompactDiv = styled.div`
    margin-top: 10px;
    border: 1px solid ${props => props.theme.borderColor};
    padding: 5px;

    &.databaseCompactIsAdvisable {
        background-color: ${props => addAlphaToColor(props.theme.errorColor, 0.3)};
    }

    & > div {
        margin-bottom: 5px;
    }
`;

@observer
export class Settings extends React.Component {
    render() {
        const databaseCompactDivClassName = classNames({
            databaseCompactIsAdvisable: settingsController.isCompactDatabaseAdvisable
        });

        return (
            <div>
                <HomeSettingsBody>
                    <PropertyList>
                        <FileInputProperty
                            name="Database location"
                            value={settingsController.databasePath}
                            onChange={settingsController.onDatabasePathChange}
                        />
                        <tr>
                            <td />
                            <td>
                                <div className="btn-toolbar">
                                    <div className="btn-group mr-2">
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={settingsController.createNewDatabase}
                                        >
                                            Create New Database
                                        </button>
                                    </div>
                                    <div className="btn-group mr-2">
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-sm"
                                            onClick={settingsController.showDatabasePathInFolder}
                                        >
                                            Show in Folder
                                        </button>
                                    </div>
                                </div>
                                {settingsController.databasePath ===
                                    settingsController.activeDatabasePath && (
                                    <DatabaseCompactDiv className={databaseCompactDivClassName}>
                                        <div>
                                            Database size is{" "}
                                            {formatBytes(settingsController.databaseSize)}.
                                        </div>
                                        <div>
                                            Database compacted{" "}
                                            {moment(
                                                settingsController.timeOfLastDatabaseCompactOperation
                                            ).fromNow()}
                                            .
                                        </div>
                                        {settingsController.isCompactDatabaseAdvisable && (
                                            <div>{COMPACT_DATABASE_MESSAGE}</div>
                                        )}
                                        <div className="btn-group mr-2">
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-sm"
                                                onClick={settingsController.compactDatabase}
                                            >
                                                Compact Database
                                            </button>
                                        </div>
                                    </DatabaseCompactDiv>
                                )}
                            </td>
                        </tr>
                        <SelectProperty
                            name="Locale"
                            value={settingsController.locale}
                            onChange={settingsController.onLocaleChange}
                        >
                            {Object.keys(LOCALES)
                                .slice()
                                .sort((a, b) =>
                                    stringCompare((LOCALES as any)[a], (LOCALES as any)[b])
                                )
                                .map(locale => (
                                    <option key={locale} value={locale}>
                                        {(LOCALES as any)[locale]}
                                    </option>
                                ))}
                        </SelectProperty>
                        <SelectProperty
                            name="Date format"
                            value={settingsController.dateFormat}
                            onChange={settingsController.onDateFormatChanged}
                        >
                            {DATE_FORMATS.map(dateFormat => (
                                <option key={dateFormat.format} value={dateFormat.format}>
                                    {moment(new Date())
                                        .locale(settingsController.locale)
                                        .format(dateFormat.format)}
                                </option>
                            ))}
                        </SelectProperty>
                        <SelectProperty
                            name="Time format"
                            value={settingsController.timeFormat}
                            onChange={settingsController.onTimeFormatChanged}
                        >
                            {TIME_FORMATS.map(timeFormat => (
                                <option key={timeFormat.format} value={timeFormat.format}>
                                    {moment(new Date())
                                        .locale(settingsController.locale)
                                        .format(timeFormat.format)}
                                </option>
                            ))}
                        </SelectProperty>
                    </PropertyList>
                </HomeSettingsBody>

                {settingsController.restartRequired && (
                    <HomeSettingsBar className="">
                        <div className="btn-group mr-2">
                            <button
                                className="btn btn-primary EezStudio_PulseTransition"
                                onClick={settingsController.restart}
                            >
                                Restart
                            </button>
                        </div>
                    </HomeSettingsBar>
                )}
            </div>
        );
    }
}
