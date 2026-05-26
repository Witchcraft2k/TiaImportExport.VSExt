using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using Siemens.Engineering;
using Siemens.Engineering.SW;
using Siemens.Engineering.SW.Tags;
using TiaOpennessWrapper.Models;

namespace TiaOpennessWrapper.Services.Export;

public class TagTableExportHandler
{
	public object ExportTagTable(PlcSoftware plcSoftware, string xmlFilePath, ExportToTiaOptions options, List<ExportMessage> messages)
	{
		//IL_014b: Expected O, but got Unknown
		//IL_0231: Expected O, but got Unknown
		//IL_02e9: Expected O, but got Unknown
		//IL_0285: Unknown result type (might be due to invalid IL or missing references)
		//IL_028e: Unknown result type (might be due to invalid IL or missing references)
		string fileName = Path.GetFileName(xmlFilePath);
		try
		{
			FileInfo fileInfo = new FileInfo(xmlFilePath);
			PlcTagTableGroup val = (PlcTagTableGroup)(object)plcSoftware.TagTableGroup;
			string text = "";
			if (options.PreserveFolderStructure && !string.IsNullOrEmpty(options.BasePath))
			{
				string relativeFolderPath = TiaGroupHelper.GetRelativeFolderPath(xmlFilePath, options.BasePath);
				if (!string.IsNullOrEmpty(relativeFolderPath))
				{
					val = TiaGroupHelper.GetOrCreateTagTableGroup((PlcTagTableGroup)(object)plcSoftware.TagTableGroup, relativeFolderPath);
					text = " (group: " + relativeFolderPath + ")";
				}
			}
			string text2 = XmlComparisonService.ExtractNameFromXml(xmlFilePath) ?? Path.GetFileNameWithoutExtension(xmlFilePath);
			PlcTagTable val2 = FindTagTable(val, text2);
			if (val2 == null && (object)val != plcSoftware.TagTableGroup)
			{
				val2 = FindTagTable((PlcTagTableGroup)(object)plcSoftware.TagTableGroup, text2);
			}
			if (options.CompareBeforeImport && val2 != null)
			{
				switch (XmlComparisonService.CompareTagTableWithXml(val2, xmlFilePath))
				{
				case BlockComparisonResult.Same:
					messages.Add(ExportMessage.Info(fileName, "TagTable", "Tag table '" + text2 + "' is identical - skipped"));
					return new
					{
						success = true,
						skipped = true,
						filePath = xmlFilePath,
						messages = messages
					};
				case BlockComparisonResult.Different:
					break;
				default:
					messages.Add(ExportMessage.Warning(fileName, "TagTable", "Tag table '" + text2 + "' exists but comparison failed - skipping"));
					return new
					{
						success = true,
						skipped = true,
						filePath = xmlFilePath,
						messages = messages
					};
				}
				if (val2.IsDefault)
				{
					ClearTagTableContents(val2, fileName, messages);
				}
				else
				{
					try
					{
						val2.Delete();
						messages.Add(ExportMessage.Info(fileName, "TagTable", "Tag table '" + text2 + "' differs - deleted and will be reimported"));
						val2 = null;
					}
					catch (EngineeringException ex)
					{
						EngineeringException ex2 = ex;
						messages.Add(ExportMessage.Warning(fileName, "TagTable", "Could not delete existing tag table '" + text2 + "': " + ((Exception)(object)ex2).Message + ". Trying import with Override..."));
					}
				}
			}
			else if (options.OverwriteExisting && !options.CompareBeforeImport && val2 != null)
			{
				if (val2.IsDefault)
				{
					ClearTagTableContents(val2, fileName, messages);
				}
				else
				{
					try
					{
						val2.Delete();
						messages.Add(ExportMessage.Info(fileName, "TagTable", "Deleted existing tag table '" + text2 + "' before export"));
						val2 = null;
					}
					catch (EngineeringException ex3)
					{
						EngineeringException ex4 = ex3;
						messages.Add(ExportMessage.Warning(fileName, "TagTable", "Could not delete tag table '" + text2 + "': " + ((Exception)(object)ex4).Message + ". Trying import with Override..."));
					}
				}
			}
			ImportOptions val3 = (ImportOptions)(options.OverwriteExisting ? 1 : 0);
			val.TagTables.Import(fileInfo, val3);
			messages.Add(ExportMessage.Success(fileName, "TagTable", "Exported successfully to " + plcSoftware.Name + text));
			if (!string.IsNullOrEmpty(options.SourceXlsxPath))
			{
				ImportConstantsFromXlsx(val, text2, options.SourceXlsxPath, messages);
			}
			return new
			{
				success = true,
				filePath = xmlFilePath,
				messages = messages
			};
		}
		catch (EngineeringException ex5)
		{
			string text3 = ErrorHelper.ExtractFullErrorMessage((Exception)ex5);
			messages.Add(ExportMessage.Error(fileName, "TagTable", "Failed to export tag table to TIA Portal", text3, xmlFilePath));
			return new
			{
				success = false,
				error = text3,
				filePath = xmlFilePath,
				messages = messages
			};
		}
		catch (Exception ex6)
		{
			string text4 = ErrorHelper.ExtractFullErrorMessage(ex6);
			messages.Add(ExportMessage.Error(fileName, "TagTable", "Failed to export tag table to TIA Portal", text4, xmlFilePath));
			return new
			{
				success = false,
				error = text4,
				filePath = xmlFilePath,
				messages = messages
			};
		}
	}

	private void ClearTagTableContents(PlcTagTable tagTable, string fileName, List<ExportMessage> messages)
	{
		int num = 0;
		int num2 = 0;
		foreach (PlcTag item in ((IEnumerable<PlcTag>)tagTable.Tags).ToList())
		{
			try
			{
				item.Delete();
				num++;
			}
			catch (Exception ex)
			{
				messages.Add(ExportMessage.Warning(fileName, "TagTable", "Could not delete tag '" + item.Name + "': " + ex.Message));
			}
		}
		foreach (PlcUserConstant item2 in ((IEnumerable<PlcUserConstant>)tagTable.UserConstants).ToList())
		{
			try
			{
				item2.Delete();
				num2++;
			}
			catch (Exception ex2)
			{
				messages.Add(ExportMessage.Warning(fileName, "TagTable", "Could not delete constant '" + item2.Name + "': " + ex2.Message));
			}
		}
		messages.Add(ExportMessage.Info(fileName, "TagTable", $"Default tag table '{tagTable.Name}' cleared ({num} tags, {num2} constants) - will be reimported with Override"));
	}

	private void ImportConstantsFromXlsx(PlcTagTableGroup targetGroup, string tableName, string xlsxFilePath, List<ExportMessage> messages)
	{
		try
		{
			List<XlsxConstantEntry> list = TagTableXlsxToXmlConverter.ReadConstantsFromXlsx(xlsxFilePath);
			if (list.Count == 0)
			{
				return;
			}
			PlcTagTable val = ((IEnumerable<PlcTagTable>)targetGroup.TagTables).FirstOrDefault((PlcTagTable t) => string.Equals(t.Name, tableName, StringComparison.OrdinalIgnoreCase));
			if (val == null)
			{
				messages.Add(ExportMessage.Warning(Path.GetFileName(xlsxFilePath), "Constants", "Tag table '" + tableName + "' not found after import - cannot create constants"));
				return;
			}
			int num = 0;
			int num2 = 0;
			int num3 = 0;
			foreach (XlsxConstantEntry constant in list)
			{
				if (string.IsNullOrWhiteSpace(constant.Name))
				{
					continue;
				}
				try
				{
					PlcUserConstant val2 = ((IEnumerable<PlcUserConstant>)val.UserConstants).FirstOrDefault((PlcUserConstant c) => string.Equals(c.Name, constant.Name, StringComparison.OrdinalIgnoreCase));
					if (val2 != null)
					{
						val2.Value = constant.Value;
						if (!string.IsNullOrEmpty(constant.DataType))
						{
							val2.DataTypeName = constant.DataType;
						}
						num2++;
						continue;
					}
					if (!string.IsNullOrEmpty(constant.DataType) && !string.IsNullOrEmpty(constant.Value))
					{
						val.UserConstants.Create(constant.Name, constant.DataType, constant.Value);
					}
					else
					{
						PlcUserConstant val3 = val.UserConstants.Create(constant.Name);
						if (!string.IsNullOrEmpty(constant.Value))
						{
							val3.Value = constant.Value;
						}
						if (!string.IsNullOrEmpty(constant.DataType))
						{
							val3.DataTypeName = constant.DataType;
						}
					}
					num++;
				}
				catch (Exception ex)
				{
					num3++;
					messages.Add(ExportMessage.Warning(Path.GetFileName(xlsxFilePath), "Constants", "Failed to create constant '" + constant.Name + "': " + ex.Message));
				}
			}
			if (num > 0 || num2 > 0)
			{
				messages.Add(ExportMessage.Info(Path.GetFileName(xlsxFilePath), "Constants", $"Constants: {num} created, {num2} updated" + ((num3 > 0) ? $", {num3} failed" : "")));
			}
		}
		catch (Exception ex2)
		{
			messages.Add(ExportMessage.Warning(Path.GetFileName(xlsxFilePath), "Constants", "Failed to import constants: " + ex2.Message));
		}
	}

	private PlcTagTable? FindTagTable(PlcTagTableGroup group, string name)
	{
		PlcTagTable val = ((IEnumerable<PlcTagTable>)group.TagTables).FirstOrDefault((PlcTagTable t) => string.Equals(t.Name, name, StringComparison.OrdinalIgnoreCase));
		if (val != null)
		{
			return val;
		}
		foreach (PlcTagTableUserGroup group2 in group.Groups)
		{
			val = FindTagTable((PlcTagTableGroup)(object)group2, name);
			if (val != null)
			{
				return val;
			}
		}
		return null;
	}
}
