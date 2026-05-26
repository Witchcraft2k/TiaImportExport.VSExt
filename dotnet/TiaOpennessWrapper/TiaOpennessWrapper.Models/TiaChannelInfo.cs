using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaChannelInfo
{
	[JsonProperty("number")]
	public int Number { get; set; }

	[JsonProperty("name")]
	public string Name { get; set; } = "";

	[JsonProperty("channelType")]
	public string ChannelType { get; set; } = "";

	[JsonProperty("ioType")]
	public string IoType { get; set; } = "";

	[JsonProperty("address")]
	public string? Address { get; set; }

	[JsonProperty("symbolName")]
	public string? SymbolName { get; set; }
}
