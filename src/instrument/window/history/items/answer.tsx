import * as React from "react";
import { observable, action } from "mobx";
import { observer } from "mobx-react";

import { formatDateTimeLong } from "shared/util";
import { IActivityLogEntry } from "shared/activity-log";

import styled from "shared/ui/styled-components";

import { IAppStore } from "instrument/window/history/history";
import { HistoryItem, HistoryItemDiv, HistoryItemDate } from "instrument/window/history/item";

////////////////////////////////////////////////////////////////////////////////

const AnswerHistoryItemDiv = styled(HistoryItemDiv)`
    background-color: lightblue;
    margin-left: 40px;
    max-width: calc(100% - 40px);
`;

@observer
export class AnswerHistoryItemComponent extends React.Component<
    {
        historyItem: HistoryItem;
    },
    {}
> {
    @observable
    showAll: boolean = false;

    render() {
        let message = this.props.historyItem.message.trim();

        let textClassName;
        if (message.indexOf("**ERROR") != -1) {
            textClassName = "text-danger";
        }

        message = message.replace(/\"\,\"/g, '",\n"');

        let content;
        if (message.length > 1024 && !this.showAll) {
            content = (
                <div>
                    <pre className={textClassName}>{message.slice(0, 1024)}</pre>
                    <div style={{ margin: "5px 0" }}>
                        <button
                            className="btn btn-sm"
                            onClick={action(() => (this.showAll = true))}
                        >
                            Show all
                        </button>
                    </div>
                </div>
            );
        } else {
            content = <pre className={textClassName}>{message}</pre>;
        }

        return (
            <AnswerHistoryItemDiv>
                <p>
                    <HistoryItemDate>
                        {formatDateTimeLong(this.props.historyItem.date)}
                    </HistoryItemDate>
                </p>
                {this.props.historyItem.sourceDescriptionElement}
                {content}
            </AnswerHistoryItemDiv>
        );
    }
}

export class AnswerHistoryItem extends HistoryItem {
    constructor(activityLogEntry: IActivityLogEntry, appStore: IAppStore) {
        super(activityLogEntry, appStore);
    }

    get listItemElement(): JSX.Element | null {
        return <AnswerHistoryItemComponent historyItem={this} />;
    }
}
