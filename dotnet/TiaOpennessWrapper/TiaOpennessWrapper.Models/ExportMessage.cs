using Newtonsoft.Json;

namespace TiaOpennessWrapper.Models;

public class ExportMessage
{
	[JsonProperty("type")]
	public string Type { get; set; } = "info";

	[JsonProperty("itemName")]
	public string ItemName { get; set; } = "";

	[JsonProperty("itemType")]
	public string ItemType { get; set; } = "";

	[JsonProperty("message")]
	public string Message { get; set; } = "";

	[JsonProperty("details")]
	public string? Details { get; set; }

	[JsonProperty("filePath")]
	public string? FilePath { get; set; }

	public static ExportMessage Success(string itemName, string itemType, string filePath)
	{
		return new ExportMessage
		{
			Type = "success",
			ItemName = itemName,
			ItemType = itemType,
			Message = "Successfully imported " + itemType + ": " + itemName,
			FilePath = filePath
		};
	}

	public static ExportMessage Success(string itemName, string itemType, string filePath, string customMessage)
	{
		return new ExportMessage
		{
			Type = "success",
			ItemName = itemName,
			ItemType = itemType,
			Message = customMessage,
			FilePath = filePath
		};
	}

	public static ExportMessage Info(string itemName, string itemType, string message)
	{
		return new ExportMessage
		{
			Type = "info",
			ItemName = itemName,
			ItemType = itemType,
			Message = message
		};
	}

	public static ExportMessage Warning(string itemName, string itemType, string message, string? details = null, string? filePath = null)
	{
		return new ExportMessage
		{
			Type = "warning",
			ItemName = itemName,
			ItemType = itemType,
			Message = message,
			Details = details,
			FilePath = filePath
		};
	}

	public static ExportMessage Error(string itemName, string itemType, string message, string? details = null, string? filePath = null)
	{
		return new ExportMessage
		{
			Type = "error",
			ItemName = itemName,
			ItemType = itemType,
			Message = message,
			Details = details,
			FilePath = filePath
		};
	}

	public static ExportMessage Deleted(string itemName, string itemType, string message)
	{
		return new ExportMessage
		{
			Type = "deleted",
			ItemName = itemName,
			ItemType = itemType,
			Message = message
		};
	}
}
