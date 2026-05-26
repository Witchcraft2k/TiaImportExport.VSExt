using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaTagInfo
{
	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("dataType")]
	public string DataType { get; set; } = "";

	[JsonProperty("address")]
	public string Address { get; set; } = "";

	[JsonProperty("comment")]
	public string? Comment { get; set; }

	[JsonProperty("hmiAccessible")]
	public bool HmiAccessible { get; set; }
}
