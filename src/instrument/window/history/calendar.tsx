import * as React from "react";
import { action } from "mobx";
import { observer } from "mobx-react";
import * as classNames from "classnames";

import {
    formatDate,
    getDayOfWeek,
    getFirstDayOfWeek,
    getDayOfWeekName,
    getWeekNumber
} from "shared/util";

import styled from "shared/ui/styled-components";

import { History } from "instrument/window/history/history";

@observer
export class Day extends React.Component<{ history: History; day: Date }> {
    render() {
        const day = this.props.day;

        const activityCount = this.props.history.calendar.getActivityCount(day);

        let activityLevel;

        let activityInfo;
        if (activityCount > 0) {
            activityInfo = `${activityCount} log items`;
            if (activityCount < 25) {
                activityLevel = 1;
            } else if (activityCount < 75) {
                activityLevel = 2;
            } else if (activityCount < 200) {
                activityLevel = 3;
            } else {
                activityLevel = 4;
            }
        } else {
            activityInfo = "No activity";
            activityLevel = 0;
        }

        let className = classNames(`activity-level-${activityLevel}`, {
            selected: this.props.history.calendar.isSelectedDay(day)
        });

        const tooltip = `${activityInfo} on ${formatDate(day)}`;

        return (
            <div
                className={className}
                title={tooltip}
                onClick={action(() => {
                    if (this.props.history.calendar.getActivityCount(day) > 0) {
                        this.props.history.calendar.selectDay(day);
                    }
                })}
            >
                <div>{day.getDate().toString()}</div>
            </div>
        );
    }
}

export class DayOfWeek extends React.Component<{ dayOfWeek: number }> {
    render() {
        return <div>{getDayOfWeekName(this.props.dayOfWeek).slice(0, 2)}</div>;
    }
}

@observer
export class Month extends React.Component<{ history: History; month: Date }> {
    element: HTMLElement | null;

    componentDidMount() {
        if (this.element && this.props.history.calendar.isSelectedMonth(this.props.month)) {
            this.element.scrollIntoView({ block: "end" });
        }
    }

    componentDidUpdate() {
        if (this.element && this.props.history.calendar.isSelectedMonth(this.props.month)) {
            this.element.scrollIntoView({ block: "nearest", behavior: "auto" });
        }
    }

    renderDays() {
        const days = [];

        const month = this.props.month;

        // 1st row contains day of week names
        for (let i = 0; i < 7; i++) {
            days.push(<DayOfWeek key={"dow" + i} dayOfWeek={(getFirstDayOfWeek() + i) % 7} />);
        }

        // 8th column of the 1st row is empty (8th column contains week number)
        days.push(<div key={"dow7"} />);

        let start = -getDayOfWeek(month);

        for (let row = 0; row < 6; row++) {
            for (let col = 0; col < 7; col++) {
                const i = start + row * 7 + col;
                const day = new Date(month);
                day.setDate(day.getDate() + i);

                if (day.getMonth() === month.getMonth()) {
                    days.push(<Day key={i} history={this.props.history} day={day} />);
                } else {
                    if (day.getMonth() != month.getMonth() && day > month && col === 0) {
                        return days;
                    }
                    // empty cell
                    days.push(<div key={i} />);
                }
            }

            // week number
            const i = start + row * 7;
            const day = new Date(month);
            day.setDate(day.getDate() + i);
            days.push(
                <div key={"w" + row} className="WeekNumber">
                    {getWeekNumber(day)}.
                </div>
            );
        }

        return days;
    }

    render() {
        const month = this.props.month;

        let className = classNames({
            selected: this.props.history.calendar.isSelectedMonth(month)
        });

        return (
            <div className={className} ref={ref => (this.element = ref)}>
                <div>{formatDate(month, "YYYY MMMM")}</div>
                <div>{this.renderDays()}</div>
            </div>
        );
    }
}

const HistoryCalendar = styled.div`
    padding: 10px;
    display: flex;
    flex-direction: column;
    align-items: center;

    & > div {
        margin: 1px;
        margin-bottom: 11px;
        padding: 5px;
        border: 1px solid ${props => props.theme.borderColor};
        background: white;

        &.selected {
            margin: 0px;
            margin-bottom: 10px;
            border: 2px solid ${props => props.theme.selectionBackgroundColor};
        }
    }

    & > div:last-child {
        margin-bottom: 1px;

        &.selected {
            margin-bottom: 0px;
        }
    }

    & > div > div:nth-child(1) {
        font-weight: bold;
    }

    & > div > div:nth-child(2) {
        line-height: 20px;
        display: grid;
        grid-template-columns: 28px 28px 28px 28px 28px 28px 28px 35px;
        grid-template-rows: 33px;
        padding-left: 33px;
        padding-top: 5px;
        padding-bottom: 5px;
    }

    & > div > div:nth-child(2) > div {
        display: inline-block;
        padding: 2px;
        border: 2px solid white;
        text-align: center;
        font-size: 12px;

        &.WeekNumber {
            justify-self: right;
        }

        &.selected {
            border: 2px solid ${props => props.theme.selectionBackgroundColor};
        }

        & > div {
            width: 20px;
            height: 20px;
            cursor: default;
        }

        &.activity-level-0 > div {
            background-color: #ebedf0;
        }

        &.activity-level-1 > div {
            background-color: #c6e48b;
        }

        &.activity-level-2 > div {
            background-color: #7bc96f;
        }

        &.activity-level-3 > div {
            background-color: #239a3b;
            color: white;
        }

        &.activity-level-4 > div {
            background-color: #196127;
            color: white;
        }
    }
`;

@observer
export class Calendar extends React.Component<{ history: History }> {
    render() {
        var months = [];

        var startMonth = new Date(this.props.history.calendar.minDate);
        startMonth.setDate(1);

        var endMonth = new Date(this.props.history.calendar.maxDate);
        endMonth.setDate(1);

        var month = new Date(startMonth);
        while (month <= endMonth) {
            months.push(
                <Month
                    key={month.toString()}
                    history={this.props.history}
                    month={new Date(month)}
                />
            );

            month.setMonth(month.getMonth() + 1);
        }

        return <HistoryCalendar>{months}</HistoryCalendar>;
    }
}
