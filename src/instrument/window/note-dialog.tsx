import * as React from "react";

import { Dialog, showDialog } from "eez-studio-shared/ui/dialog";
import { PropertyList, RichTextProperty } from "eez-studio-shared/ui/properties";

class NoteDialog extends React.Component<
    {
        note?: string;
        callback: (note: string) => void;
    },
    {}
> {
    constructor(props: any) {
        super(props);

        this.handleChange = this.handleChange.bind(this);
        this.handleSubmit = this.handleSubmit.bind(this);

        this.note = this.props.note || "";
    }

    note: string;

    handleChange(value: string) {
        this.note = value;
    }

    handleSubmit() {
        this.props.callback(this.note);
        return true;
    }

    render() {
        return (
            <Dialog onOk={this.handleSubmit} large={true}>
                <PropertyList>
                    <RichTextProperty
                        name="text"
                        value={this.props.note}
                        onChange={this.handleChange}
                    />
                </PropertyList>
            </Dialog>
        );
    }
}

export function showAddNoteDialog(callback: (note: string) => void) {
    showDialog(<NoteDialog callback={callback} />);
}

export function showEditNoteDialog(note: string, callback: (note: string) => void) {
    showDialog(<NoteDialog callback={callback} note={note} />);
}
