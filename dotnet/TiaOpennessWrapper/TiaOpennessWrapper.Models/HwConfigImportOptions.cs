using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class HwConfigImportOptions
{
	[JsonProperty("includeChannels")]
	public bool IncludeChannels { get; set; } = true;

	[JsonProperty("includeAddresses")]
	public bool IncludeAddresses { get; set; } = true;

	[JsonProperty("includeNetworkConfig")]
	public bool IncludeNetworkConfig { get; set; } = true;

	[JsonProperty("includeSubnets")]
	public bool IncludeSubnets { get; set; } = true;

	[JsonProperty("exportToXml")]
	public bool ExportToXml { get; set; }

	[JsonProperty("exportPath")]
	public string? ExportPath { get; set; }

	[JsonProperty("format")]
	public string Format { get; set; } = "xml";
}
