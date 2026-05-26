using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaHmiTagInfo
{
	[JsonProperty("id")]
	public string Id { get; set; } = "";

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("dataType")]
	public string? DataType { get; set; }

	[JsonProperty("connection")]
	public string? Connection { get; set; }

	[JsonProperty("plcTag")]
	public string? PlcTag { get; set; }
}
