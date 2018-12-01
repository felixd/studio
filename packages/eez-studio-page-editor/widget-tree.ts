import { Point, Rect, pointInRect } from "eez-studio-shared/geometry";

import {
    EezObject,
    PropertyType,
    isArray,
    asArray,
    getProperty
} from "eez-studio-shared/model/object";
import {
    DisplayItem,
    DisplayItemChildrenObject,
    DisplayItemChildrenArray,
    DisplayItemChildren
} from "eez-studio-shared/model/objectAdapter";

import { PageEditorContext } from "eez-studio-page-editor/context";
import { Page } from "eez-studio-page-editor/page";
import {
    Widget,
    ListWidget,
    GridWidget,
    SelectWidget,
    IWidgetContainerDisplayItem
} from "eez-studio-page-editor/widget";

////////////////////////////////////////////////////////////////////////////////

export interface LineConnecting {
    move(target: TreeNode | undefined, p: Point): void;
    draw(ctx: CanvasRenderingContext2D, scale: number): void;
    commit(): void;
}

export interface TreeNode {
    parent: TreeNode;
    children: TreeNode[];

    rect: Rect;
    selected: boolean;
    selectable: boolean;
    movable: boolean;
    resizable: boolean;

    item: DisplayItem;
    custom?: any;

    hitTest?: (treeNode: TreeNode, p: Point) => boolean;
    draw?: (
        treeNode: TreeNode,
        ctx: CanvasRenderingContext2D,
        scale: number,
        callback: () => void
    ) => void;
    image?: HTMLCanvasElement | undefined;
    drawSelectedDecoration?: (
        treeNode: TreeNode,
        ctx: CanvasRenderingContext2D,
        scale: number
    ) => void;
    startLineConnecting?: (treeNode: TreeNode, p: Point) => LineConnecting;
}

export enum TraverseTreeContinuation {
    CONTINUE,
    SKIP_CHILDREN,
    BREAK
}

export function traverseTree(
    node: TreeNode,
    callback: (node: TreeNode) => TraverseTreeContinuation | void
) {
    let result = callback(node);
    if (result == undefined || result === TraverseTreeContinuation.CONTINUE) {
        for (let i = 0; i < node.children.length; i++) {
            if (traverseTree(node.children[i], callback) == TraverseTreeContinuation.BREAK) {
                return TraverseTreeContinuation.BREAK;
            }
        }
    }

    return result;
}

export function nodesFromPoint(tree: TreeNode, p: Point) {
    let result: TreeNode[] = [];

    traverseTree(tree, node => {
        if (
            node != tree &&
            ((node.hitTest && node.hitTest(node, p)) || (node.rect && pointInRect(p, node.rect)))
        ) {
            result.push(node);
        }
        return TraverseTreeContinuation.CONTINUE;
    });

    return result;
}

////////////////////////////////////////////////////////////////////////////////

class DummyWidgetContainerDisplayItem implements DisplayItem, IWidgetContainerDisplayItem {
    selected: boolean;

    constructor(public object: EezObject) {}

    get children(): DisplayItemChildren {
        if (isArray(this.object)) {
            return asArray(this.object).map(child => new DummyWidgetContainerDisplayItem(child));
        } else {
            let properties = this.object._classInfo.properties.filter(
                propertyInfo =>
                    (propertyInfo.type === PropertyType.Object ||
                        propertyInfo.type === PropertyType.Array) &&
                    !(propertyInfo.enumerable !== undefined && !propertyInfo.enumerable) &&
                    getProperty(this.object, propertyInfo.name)
            );

            if (properties.length == 1 && properties[0].type === PropertyType.Array) {
                return asArray(getProperty(this.object, properties[0].name)).map(
                    child => new DummyWidgetContainerDisplayItem(child)
                );
            }

            return properties.reduce(
                (children, propertyInfo, i) => {
                    children[propertyInfo.name] = new DummyWidgetContainerDisplayItem(
                        getProperty(this.object, propertyInfo.name)
                    );
                    return children;
                },
                {} as DisplayItemChildrenObject
            );
        }
    }

    getSelectedWidgetForSelectWidget(item: DisplayItem): DisplayItem | undefined {
        let widget = item.object as SelectWidget;
        if (widget.data && widget.widgets) {
            let index: number = PageEditorContext.data.getEnumValue(widget.data);
            if (index >= 0 && index < widget.widgets._array.length) {
                let widgetsItemChildren = item.children as DisplayItemChildrenArray;

                return widgetsItemChildren[index];
            }
        }
        return undefined;
    }
}

////////////////////////////////////////////////////////////////////////////////

function drawPageFrameForTreeNode(
    node: TreeNode,
    ctx: CanvasRenderingContext2D,
    scale: number,
    callback: () => void
) {
    let page = node.item.object as Page;
    PageEditorContext.draw.drawPageFrame(
        ctx,
        {
            left: page.x,
            top: page.y,
            width: page.width,
            height: page.height
        },
        scale,
        page.style || "default"
    );
}

export function createWidgetTree(
    widgetContainerDisplayItemOrObject: IWidgetContainerDisplayItem | EezObject,
    draw: boolean
) {
    function enumWidgets(widgetContainerDisplayItem: IWidgetContainerDisplayItem) {
        function enumWidget(
            parentNode: TreeNode | undefined,
            item: DisplayItem,
            x: number,
            y: number
        ) {
            let object = item.object as Widget | Page;

            x += object.x || 0;
            y += object.y || 0;

            let rect = {
                left: x,
                top: y,
                width: object.width,
                height: object.height
            };

            let treeNode: TreeNode = {
                parent: <TreeNode>parentNode,
                children: [],
                rect,
                selected: object instanceof Widget && item.selected,
                resizable: true,
                movable: object instanceof Widget,
                selectable: object instanceof Widget,
                item: item,
                draw: object instanceof Widget ? undefined : drawPageFrameForTreeNode,
                image: draw && object instanceof Widget ? object.draw(rect) : undefined
            };

            if (parentNode) {
                parentNode.children.push(treeNode);
            }

            if (object instanceof Widget) {
                if (object.type == "Container") {
                    let widgetsItemChildren = item.children as DisplayItemChildrenArray;

                    widgetsItemChildren.forEach(child => {
                        enumWidget(treeNode, child, x, y);
                    });
                } else if (object.type == "List") {
                    let widget = object as ListWidget;
                    let itemWidget = widget.itemWidget;
                    if (itemWidget) {
                        let itemWidgetItem = (item.children as DisplayItemChildrenObject)[
                            "itemWidget"
                        ];

                        for (
                            let i = 0;
                            i < PageEditorContext.data.count(<string>widget.data);
                            i++
                        ) {
                            enumWidget(treeNode, itemWidgetItem, x, y);

                            if (widget.listType == "vertical") {
                                y += itemWidget.height;
                            } else {
                                x += itemWidget.width;
                            }
                        }
                    }
                } else if (object.type == "Grid") {
                    let widget = object as GridWidget;
                    let itemWidget = widget.itemWidget;
                    if (itemWidget) {
                        let itemWidgetItem = (item.children as DisplayItemChildrenObject)[
                            "itemWidget"
                        ];

                        for (
                            let i = 0;
                            i < PageEditorContext.data.count(<string>widget.data);
                            i++
                        ) {
                            enumWidget(treeNode, itemWidgetItem, x, y);

                            if (x + itemWidget.width < widget.width) {
                                x += itemWidget.width;
                            } else {
                                if (y + itemWidget.height < widget.height) {
                                    y += itemWidget.height;
                                    x = rect.left;
                                } else {
                                    break;
                                }
                            }
                        }
                    }
                } else if (object.type == "Select") {
                    let selectedWidgetItem = widgetContainerDisplayItem.getSelectedWidgetForSelectWidget(
                        item
                    );
                    if (selectedWidgetItem) {
                        enumWidget(treeNode, selectedWidgetItem, x, y);
                    }
                }
            } else {
                let widgetsItemChildren = item.children as DisplayItemChildrenArray;

                widgetsItemChildren.forEach(child => {
                    enumWidget(treeNode, child, x, y);
                });
            }

            return treeNode;
        }

        return enumWidget(undefined, widgetContainerDisplayItem, 0, 0);
    }

    if (widgetContainerDisplayItemOrObject instanceof EezObject) {
        return enumWidgets(new DummyWidgetContainerDisplayItem(widgetContainerDisplayItemOrObject));
    } else {
        return enumWidgets(widgetContainerDisplayItemOrObject);
    }
}

export function drawTree(
    ctx: CanvasRenderingContext2D,
    tree: TreeNode,
    scale: number,
    callback: () => void
) {
    traverseTree(tree, node => {
        if (node.draw) {
            node.draw(node, ctx, scale, callback);
        } else if (node.image && node.image.width && node.image.height) {
            ctx.drawImage(node.image, node.rect.left, node.rect.top);
            if (
                node.rect.left < tree.rect.left ||
                node.rect.left + node.rect.width > tree.rect.left + tree.rect.width ||
                node.rect.top < tree.rect.top ||
                node.rect.top + node.rect.height > tree.rect.top + tree.rect.height
            ) {
                ctx.save();

                ctx.beginPath();
                ctx.rect(node.rect.left, node.rect.top, node.rect.width, node.rect.height);
                ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
                ctx.stroke();

                ctx.clip();

                ctx.beginPath();

                let OFFSET = 12;

                for (
                    let y = OFFSET + 0.5;
                    y <
                    Math.max(node.rect.width, node.rect.height) +
                        Math.min(node.rect.width, node.rect.height);
                    y += OFFSET
                ) {
                    ctx.moveTo(node.rect.left, node.rect.top + y);
                    ctx.lineTo(node.rect.left + y, node.rect.top);
                }

                ctx.strokeStyle = "rgba(255, 0, 0, 0.2)";
                ctx.stroke();

                ctx.restore();

                // ctx.fillStyle = "rgba(255, 0, 0, 0.2)";
                // ctx.fillRect(node.rect.x, node.rect.y, node.rect.width, node.rect.height);
            }
        }
    });
}