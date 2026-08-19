import { X } from "lucide-react";

import { Button, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@linktag/ui";

import type { EdgeLineType, ElkLayout } from "../../types";

export function GraphWindowControls({
  elkLayout,
  edgeLineType,
  onElkLayoutChange,
  onEdgeLineTypeChange,
  onClose,
}: {
  elkLayout: ElkLayout;
  edgeLineType: EdgeLineType;
  onElkLayoutChange: (value: ElkLayout) => void;
  onEdgeLineTypeChange: (value: EdgeLineType) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="ml-auto flex shrink-0 items-center gap-2"
      data-ui-name="关系图浮窗控制组"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <Select value={elkLayout} onValueChange={(value) => onElkLayoutChange(value as ElkLayout)}>
        <SelectTrigger className="h-8 w-32 bg-background" data-ui-name="ELK布局选择器">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="horizontal">ELK 横向</SelectItem>
          <SelectItem value="vertical">ELK 纵向</SelectItem>
          <SelectItem value="force">ELK Force</SelectItem>
          <SelectItem value="stress">ELK Stress</SelectItem>
        </SelectContent>
      </Select>
      <Select value={edgeLineType} onValueChange={(value) => onEdgeLineTypeChange(value as EdgeLineType)}>
        <SelectTrigger className="h-8 w-24 bg-background" data-ui-name="ELK线条类型选择器">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="curve">曲线</SelectItem>
          <SelectItem value="orthogonal">直角</SelectItem>
          <SelectItem value="straight">直线</SelectItem>
          <SelectItem value="none">无线条</SelectItem>
        </SelectContent>
      </Select>
      <Button
        data-ui-name="关系图浮窗关闭按钮"
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-8 bg-background"
        onClick={onClose}
        aria-label="关闭关系图"
        title="关闭关系图"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
