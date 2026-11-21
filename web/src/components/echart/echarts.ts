// The one module that imports ECharts (design decision 3). It registers only what the charts draw with, and the SVG
// renderer alone (decision 2): it runs in jsdom and stays sharp at any zoom. load.ts imports this module lazily, so it
// becomes its own chunk, assets/echarts-<hash>.js, that no page pays for until a chart mounts.
// A chart that needs another series type or component adds it to the list below, one name per line in alphabetical
// order, adds its option type to EChartsOption, and raises the bundle budget in web/scripts/check-bundle.mjs.
import { CustomChart, LineChart } from "echarts/charts";
import type { CustomSeriesOption, LineSeriesOption } from "echarts/charts";
import { DataZoomSliderComponent, GridComponent } from "echarts/components";
import type { DataZoomComponentOption, GridComponentOption } from "echarts/components";
import { init, use } from "echarts/core";
import type { ComposeOption } from "echarts/core";
import { SVGRenderer } from "echarts/renderers";

use([
  CustomChart,
  DataZoomSliderComponent,
  GridComponent,
  LineChart,
  SVGRenderer,
]);

export { init };

/** An option made of the parts registered above. Other modules import ECharts' types from here, never from echarts. */
export type EChartsOption = ComposeOption<CustomSeriesOption | DataZoomComponentOption | GridComponentOption | LineSeriesOption>;
export type { EChartsType as ECharts, ElementEvent, Payload, SetOptionOpts } from "echarts/core";
export type { CustomSeriesOption, LineSeriesOption };

/** One item of an option key that takes an item or a list, such as one x axis or one series. */
type One<T> = T extends readonly (infer U)[] ? U : T;
export type XAXisComponentOption = One<NonNullable<EChartsOption["xAxis"]>>;
export type YAXisComponentOption = One<NonNullable<EChartsOption["yAxis"]>>;
export type SeriesOption = One<NonNullable<EChartsOption["series"]>>;
/** The slider, the one dataZoom registered. Only the main entry names it, and only as a type. */
export type { SliderDataZoomComponentOption } from "echarts";
export type CustomSeriesRenderItem = NonNullable<CustomSeriesOption["renderItem"]>;
export type CustomSeriesRenderItemParams = Parameters<CustomSeriesRenderItem>[0];
export type CustomSeriesRenderItemAPI = Parameters<CustomSeriesRenderItem>[1];
