using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class TiaModuleAddressInfo
{
	[JsonProperty("inputStartAddress")]
	public int? InputStartAddress { get; set; }

	[JsonProperty("inputLength")]
	public int? InputLength { get; set; }

	[JsonProperty("outputStartAddress")]
	public int? OutputStartAddress { get; set; }

	[JsonProperty("outputLength")]
	public int? OutputLength { get; set; }
}
